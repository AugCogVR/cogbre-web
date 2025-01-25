import { 
    OxideCollection, 
    OxideBinary, 
    OxideFunction, 
    OxideBasicBlock, 
    OxideInstruction,
    OxideDecompLine
  } from './OxideData';

// Post a command to Nexus and return the response.
async function nexusSync(commandList) 
{
  try 
  {
    const payload = 
    { 
      sessionId: sessionStorage.getItem('uuid'), 
      command: commandList 
    };
    console.log('Nexus sync payload:', payload);

    const response = await fetch('/client_sync', 
    {
      method: 'POST',
      headers: 
      {
        'Content-Type': 'application/json',  
      },
      body: JSON.stringify(payload), 
    });

    if (!response.ok) 
    {
      throw new Error(`Failed to sync with API: ${response.statusText}`);
    }

    const responseJson = response.json();
    console.log('Nexus sync response:', responseJson);
    return responseJson;
  } 
  catch (error) 
  {
    console.error('Error posting client sync:', error);
    throw error;
  }
}

// Call Oxide's retrieve method with the given parameters and 
// return whatever comes back.
async function retrieveTextForArbitraryModule(moduleName, oid, parameters, firstOIDOnly) 
{
  let returnMe = "";
  try 
  {
    const retrievedJsonString = await nexusSync(['oxide_retrieve', moduleName, [oid], parameters]);
    if (retrievedJsonString) 
    {
      const retrievedJson = JSON.parse(retrievedJsonString);
      let jsonToProcess = retrievedJson;

      // If we need only the first OID, access it directly
      if (firstOIDOnly) 
      {
        jsonToProcess = retrievedJson[oid];
      }

      // Loop through the keys and values in the JSON object and append them to returnMe
      for (let key in jsonToProcess) 
      {
        if (jsonToProcess.hasOwnProperty(key)) 
        {
          returnMe += `${key}: ${JSON.stringify(jsonToProcess[key])}\n`;
        }
      }
    }
  } 
  catch (error) 
  {
    console.error('Error retrieving data:', error);
  }
  return returnMe;
}

// Initialize session with Nexus.
async function initializeNexusSession(commandList) 
{
  // Initialize the session
  const initResponse = await nexusSync(['session_init_web', {}]);
  console.log('Session init: ' + JSON.stringify(initResponse));
}

// Pull the list of collections from Nexus / Oxide.
async function buildCollectionMap() 
{
  // Get collection names
  const collectionNamesResponse = await nexusSync(['oxide_collection_names']);
  const collectionNameList = JSON.parse(collectionNamesResponse);

  // Build collection objects and collection map
  const collectionMap = new Map();
  for (const collectionName of collectionNameList) 
  {
    try 
    {
      let collectionId = await nexusSync(['oxide_get_cid_from_name', collectionName]);
      console.log("Processing: ", collectionName, collectionId);
      collectionId = collectionId.replace(/"/g, '');
      collectionMap.set(collectionName, new OxideCollection(collectionId, collectionName));
    } 
    catch (error) 
    {
      console.error(`Error processing collection ${collectionName}:`, error);
    }
  }

  return collectionMap;
}

// For a given collection, pull information about the files it contains
// from Nexus and store that in the collection object.
async function buildBinaryMap(collection) 
{
  collection.binaryMap = new Map();  
  try 
  {
    const oidListJson = await nexusSync(['oxide_get_oids_with_cid', collection.collectionId]);
    const oidList = JSON.parse(oidListJson);  
    for (const oid of oidList) 
      {
      try 
      {
        const binaryNameListJson = await nexusSync(['oxide_get_names_from_oid', oid]);
        const binaryNameList = JSON.parse(binaryNameListJson);
        let binaryName = "Nameless Binary";        
        if (binaryNameList.length > 0) 
        {
          binaryName = binaryNameList[0];
        }
        const size = await nexusSync(['oxide_get_oid_file_size', oid]);
        const binary = new OxideBinary(oid, binaryName, size);
        binary.parentCollection = collection;
        collection.binaryMap.set(binaryName, binary);
      } 
      catch (error) 
      {
        console.error(`Error processing OID ${oid}:`, error);
      }  
    }
  } 
  catch (error) 
  {
    console.error("Error processing binaries:", error);
  }
}

// For a given binary, pull information it
// from Nexus and store that in the binary object.
// SUPER MEGA-FUNCTION! Someone may break this up
// into smaller functions one day. I am not someone
// and today is not that day. 
async function ensureBinaryInfo(binary) 
{
  // INSTRUCTIONS
  if (binary.instructionMap == null) 
  {
    // Pull the disassembly into a map of instructions, keyed by offset
    binary.instructionMap = new Map();
    const disassemblyJsonString = await nexusSync(['oxide_get_disassembly', binary.oid]);

    if (disassemblyJsonString) 
    {
      const disassemblyJson = JSON.parse(disassemblyJsonString)[binary.oid].instructions;
      for (const [offset, value] of Object.entries(disassemblyJson)) 
      {
        // Create new instruction object and add to map
        const str = value.str;
        const instruction = new OxideInstruction(offset, str);
        const instructionMapKey = parseInt(offset);
        binary.instructionMap.set(instructionMapKey, instruction);

        // Set additional values
        instruction.mnemonic = value.mnemonic;
        instruction.op_str = value.op_str;
      }
    }
  }

  // BASIC BLOCKS
  if (binary.basicBlockMap == null) 
  {
    // Pull the basic block info
    binary.basicBlockMap = new Map();
    const basicBlocksJsonString = await nexusSync(['oxide_get_basic_blocks', binary.oid]);

    if (basicBlocksJsonString) 
    {
      const basicBlocksJson = JSON.parse(basicBlocksJsonString)[binary.oid];

      for (const [offset, value] of Object.entries(basicBlocksJson)) 
      {
        // Create new basic block object and add to map
        const basicBlock = new OxideBasicBlock(offset);
        const basicBlockMapKey = parseInt(offset);
        binary.basicBlockMap.set(basicBlockMapKey, basicBlock);

        // Set additional values
        basicBlock.instructionMap = new Map();
        for (const addr of value.members) 
        {
          const instructionOffset = parseInt(addr);
          if (binary.instructionMap.has(instructionOffset)) 
          {
            const instruction = binary.instructionMap.get(instructionOffset);
            basicBlock.instructionMap.set(instructionOffset, instruction);
          } 
          else 
          {
            console.log(`For binary ${binary.name}: instruction offset ${instructionOffset} not in instructionMap`);
          }
        }

        basicBlock.destinationAddressList = value.dests.map(dest => `${dest}`);
        basicBlock.sourceBasicBlockMap = new Map();
        basicBlock.targetBasicBlockMap = new Map();
      }

      // Now walk through each block and identify source and target blocks
      for (const [blockKey, sourceBlock] of binary.basicBlockMap) 
      {
        for (const destinationAddress of sourceBlock.destinationAddressList) 
        {
          // Check if the destination is a valid offset
          let targetOffset = -1;
          try 
          {
            targetOffset = parseInt(destinationAddress);
          } 
          catch (e) { }

          // If valid, update source and target maps
          if (binary.basicBlockMap.has(targetOffset)) 
          {
            const targetBlock = binary.basicBlockMap.get(targetOffset);
            sourceBlock.targetBasicBlockMap.set(targetOffset, targetBlock);
            targetBlock.sourceBasicBlockMap.set(blockKey, sourceBlock);
          }
        }
      }
    }
  }

  // FUNCTIONS
  if (binary.functionMap == null) 
  {
    // Pull the function info
    binary.functionMap = new Map();
    const functionsJsonString = await nexusSync(['oxide_retrieve', 'function_extract', [binary.oid], {}]);

    if (functionsJsonString) 
    {
      let dummyOffset = Number.MAX_VALUE - 1;
      const functionsJson = JSON.parse(functionsJsonString);

      for (const [name, value] of Object.entries(functionsJson)) 
      {
        // Get initial values, create new function object, add to map
        let offsetInt = -1;
        if (value.start !== null) 
        {
          offsetInt = value.start;
        } 
        else 
        {
          // HACK: Use dummy offset for functions with null starting offset. 
          offsetInt = dummyOffset--;
        }

        const signature = value.signature;
        const functionObj = new OxideFunction(name, `${offsetInt}`, signature);
        binary.functionMap.set(offsetInt, functionObj);

        // Set additional values
        functionObj.vaddr = value.vaddr;
        functionObj.retType = value.retType;
        functionObj.returning = (value.returning === 'true');
        functionObj.basicBlockMap = new Map();

        for (const block of value.blocks) 
        {
          const blockOffset = parseInt(block);
          functionObj.basicBlockMap.set(blockOffset, binary.basicBlockMap.get(blockOffset));
        }

        functionObj.paramsList = value.params.map(param => `${param}`);
        functionObj.sourceFunctionMap = new Map();
        functionObj.targetFunctionMap = new Map();
        functionObj.capaList = []; // Will fill in later
      }
    }
  }

  // CLEANUP 1
  // Walk through the instructions, basic blocks, and functions to set parent references.
  for (const basicBlock of binary.basicBlockMap.values()) 
  {
    for (const instruction of basicBlock.instructionMap.values()) 
    {
      instruction.parentBlock = basicBlock;
    }
  }

  for (const functionObj of binary.functionMap.values()) 
  {
    functionObj.parentBinary = binary;
    for (const basicBlock of functionObj.basicBlockMap.values()) 
    {
      basicBlock.parentFunction = functionObj;
    }
  }

  // HACK: Create dummy function to contain orphaned blocks
  const mainDummyOffset = Number.MAX_VALUE;
  const mainDummyFunction = new OxideFunction("__orphaned_blocks", `${mainDummyOffset}`, "dummy function");
  binary.functionMap.set(mainDummyOffset, mainDummyFunction);
  mainDummyFunction.parentBinary = binary;
  mainDummyFunction.vaddr = "0";
  mainDummyFunction.retType = "unknown";
  mainDummyFunction.returning = false;
  mainDummyFunction.sourceFunctionMap = new Map();
  mainDummyFunction.targetFunctionMap = new Map();
  mainDummyFunction.basicBlockMap = new Map();

  // Set parent and child relationships for orphaned blocks
  for (const [blockKey, block] of binary.basicBlockMap) 
  {
    if (!block.parentFunction) 
    {
      block.parentFunction = mainDummyFunction;
      mainDummyFunction.basicBlockMap.set(blockKey, block);
    }
  }

  // CLEANUP 2
  // Update function-level sources and targets now that we have bi-directional links
  const functionCallsJsonString = await nexusSync(['oxide_retrieve', 'function_calls', [binary.oid], {}]);
  if (functionCallsJsonString) 
  {
    const functionCallsJson = JSON.parse(functionCallsJsonString);

    for (const [sourceOffsetStr, value] of Object.entries(functionCallsJson)) 
    {
      const sourceOffset = parseInt(sourceOffsetStr);
      if (binary.instructionMap.has(sourceOffset)) 
      {
        const instruction = binary.instructionMap.get(sourceOffset);
        const basicBlock = instruction.parentBlock;
        const sourceFunction = basicBlock.parentFunction;

        const targetOffset = parseInt(value.func_addr);
        if (binary.functionMap.has(targetOffset)) 
        {
          const targetFunction = binary.functionMap.get(targetOffset);
          sourceFunction.targetFunctionMap.set(targetOffset, targetFunction);
          targetFunction.sourceFunctionMap.set(sourceOffset, sourceFunction);
        }
      }
    }
  }

  // CAPA
  // Load Capa-identified capability strings into respective function objects
  const capaJsonString = await nexusSync(['oxide_retrieve', 'capa_results', [binary.oid], {}]);
  if (capaJsonString) 
  {
    const capaJson = JSON.parse(capaJsonString)[binary.oid].capa_capabilities;

    for (const [capability, offsets] of Object.entries(capaJson)) 
    {
      for (const offset of offsets) 
      {
        const offsetInt = parseInt(offset);
        if (binary.functionMap.has(offsetInt)) 
        {
          binary.functionMap.get(offsetInt).capaList.push(capability);
        } 
        else 
        {
          console.log(`CAPA capability "${capability}" at func offset ${offsetInt}: FUNCTION NOT FOUND AT OFFSET!`);
        }
      }
    }
  }

  // DECOMPILATION
  // Pull decompilation for this binary
  try 
  {
    const decompJsonString = await nexusSync(['oxide_retrieve', 'ghidra_decmap', [binary.oid], {'org_by_func':true}]);
    
    if (decompJsonString != null) 
    {
      const decompJson = JSON.parse(decompJsonString).decompile;

      // Create the binary-level decomp line map
      binary.decompMap = new Map();

      // Walk through the functions in the JSON data
      for (const [functionName, funcItem] of Object.entries(decompJson)) 
      {
        let functionObj = Array.from(binary.functionMap.values())
        .find(func => func.name === functionName);

        if (!functionObj) 
        {
          console.warn(`WARNING: Could not find function object for name ${functionName}`);
          continue;
        }

        // Walk through the offsets and populate the decomp lines and associated offsets
        for (const [offsetKey, offsetItem] of Object.entries(funcItem)) 
        {
          let offset = -1;
          try 
          {
            offset = parseInt(offsetKey);
          } 
          catch (e) {}

          // For this offset, walk through the lines to add to the decomp line map
          for (const lineJson of offsetItem.line) 
          {
            // Extract the line number and code text 
            const line = lineJson;
            const split = line.indexOf(": ");
            const lineNoStr = line.substring(0, split);
            const lineNo = parseInt(lineNoStr);
            const code = line.substring(split + 2);

            // Find the decomp line for this line number. Create it if not existing.
            let decompLine = null;
            if (functionObj.decompMap.has(lineNo))
            {
              decompLine = functionObj.decompMap.get(lineNo);
            }
            else
            {
              decompLine = new OxideDecompLine(code);
              functionObj.decompMap.set(lineNo, decompLine);
            }

            // For meaningful offsets, perform several actions.
            if (offset >= 0) 
            {
              // Look up the instruction associated with this offset and add it to the decompLine's associated instruction map
              if (binary.instructionMap.has(offset)) 
              {
                decompLine.associatedInstructionMap.set(offset, binary.instructionMap.get(offset));
              }

              // In binary-level map, create map for this offset if not already there.
              if (!binary.decompMap.has(offset)) 
              {
                binary.decompMap.set(offset, new Map());
              }

              // And add the line to the binary-level map for this offset.
              binary.decompMap.get(offset).set(lineNo, decompLine);
            }
          }
        }
      }
    }
  } 
  catch (error) 
  {
    console.error("Error retrieving decomp data:", error);
  }
}

export 
{ 
  nexusSync,
  retrieveTextForArbitraryModule,
  initializeNexusSession,
  buildCollectionMap,
  buildBinaryMap,
  ensureBinaryInfo
};
