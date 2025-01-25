import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
// import logo from './logo.svg';
import './App.css';
// import DictionaryTable from './components/DictionaryTable';
import { 
  OxideCollection, 
  OxideBinary, 
  OxideFunction, 
  OxideBasicBlock, 
  OxideInstruction 
} from './models/OxideData';
import MessageBox from './components/MessageBox';

function App() 
{
  // State: variables whose state changes cause app re-render
  const [uuid, setUuid] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const [collectionMap, setCollectionMap] = useState(null);
  const [collectionNamesPulldown, setCollectionNamesPulldown] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  
  const [binaryNamesPulldown, setBinaryNamesPulldown] = useState([]);
  const [selectedBinary, setSelectedBinary] = useState('');

  const [functionNamesPulldown, setFunctionNamesPulldown] = useState([]);
  const [selectedFunction, setSelectedFunction] = useState('');

  const [messageBoxes, setMessageBoxes] = useState([]);

  // Refs: variables whose state is preserved across re-renders
  // const testButtonCounter = useRef(0);


  /////////////////////////////////////////////
  // Various support functions
  /////////////////////////////////////////////

  // Test if an object is empty (this is not built into Javascript...)
  function isEmpty(obj) 
  {
    return Object.keys(obj).length === 0;
  }

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

  // Add a new message box 
  function addMessageBox(title, message)
  {
    const newMessageBox = 
    {
      id: Date.now(), // Use current timestamp as unique ID
      title: title,
      message: message,
    };
    setMessageBoxes([...messageBoxes, newMessageBox]);
    console.log("MESSAGE BOX: ", message);
    return newMessageBox.id;
  }

  // Remove a message box by ID
  function removeMessageBox(id) 
  {
    setMessageBoxes(messageBoxes.filter((box) => box.id !== id));
  }

  // Initialize the sesison with Nexus, get the list of collections,
  // and populate the UI with collection list.
  async function initializeSession() 
  {
    // Initialize the session
    const initResponse = await nexusSync(['session_init_web', {}]);
    console.log('Session init: ' + JSON.stringify(initResponse));

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
    setCollectionMap(collectionMap);

    // Put collection names in pulldown menu
    const sortedCollectionNames = Array.from(collectionMap.keys()).sort();
    setCollectionNamesPulldown(sortedCollectionNames);

    document.getElementById('FileStatsButton').disabled = true;
    document.getElementById('StringsButton').disabled = true;
    document.getElementById('CallGraphButton').disabled = true;
    document.getElementById('DisassemblyButton').disabled = true;
    document.getElementById('DecompilationButton').disabled = true;
    document.getElementById('CFGButton').disabled = true;

    console.log('Collections: ' + sortedCollectionNames);
    setStatusMessage('Session initialized');
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
    const mainDummyFunction = new OxideFunction("dummy", `${mainDummyOffset}`, "dummy function");
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

    // ADDITIONAL ACTIVITIES
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
  }


  /////////////////////////////////////////////
  // UI Callbacks
  /////////////////////////////////////////////

  // Handle clicking the close session button
  async function handleCloseSessionClick() 
  {
    nexusSync(['session_close'])
    .then((responseData) => 
    {
      console.log('Session close: ' + JSON.stringify(responseData));
      setUuid("");
      setStatusMessage('Session ended. Close this page to quit, or reload for a new session.')
    });
  }

  // Handle selecting a new collection
  async function handleCollectionChange(event) 
  {
    // Find the collection object 
    const collectionName = event.target.value;
    const currCollection = collectionMap.get(collectionName);

    // Indicate which collection is selected
    setSelectedCollection(collectionName);

    // Ensure the collection has file info
    if (currCollection.binaryMap == null)
    {
      await buildBinaryMap(currCollection);
    }

    // Populate the UI control with a sorted list of file names
    const sortedBinaryNames = Array.from(currCollection.binaryMap.keys()).sort();
    setBinaryNamesPulldown(sortedBinaryNames);

    // Enable/disable other UI elements as appropriate
    setSelectedBinary('');
    setSelectedFunction('');
    setFunctionNamesPulldown([]);
    document.getElementById('FileStatsButton').disabled = true;
    document.getElementById('StringsButton').disabled = true;
    document.getElementById('CallGraphButton').disabled = true;
    document.getElementById('DisassemblyButton').disabled = true;
    document.getElementById('DecompilationButton').disabled = true;
    document.getElementById('CFGButton').disabled = true;
  }

  // Handle selecting a new binary
  async function handleBinaryChange(event) 
  {
    // Find the collection and binary objects
    const binaryName = event.target.value;
    const currCollection = collectionMap.get(selectedCollection);
    const currBinary = currCollection.binaryMap.get(binaryName);

    // Indicate which file is chosen
    setSelectedBinary(binaryName);

    // Ensure the binary object has function info
    if (currBinary.functionMap == null)
    {
      await ensureBinaryInfo(currBinary);
    }

    // Populate the UI control with a sorted list of file names
    const functionEntries = Array.from(currBinary.functionMap.entries());
    const sortedFunctionNames = functionEntries
        .map(([offset, func]) => func.name)  // Extract function names
        .sort();  // Sort alphabetically by default
    setFunctionNamesPulldown(sortedFunctionNames);

    // Enable/disable other UI elements as appropriate
    setSelectedFunction('');
    document.getElementById('FileStatsButton').disabled = false;
    document.getElementById('StringsButton').disabled = false;
    document.getElementById('CallGraphButton').disabled = false;
    document.getElementById('DisassemblyButton').disabled = true;
    document.getElementById('DecompilationButton').disabled = true;
    document.getElementById('CFGButton').disabled = true;
  }

  // Handle clicking File Stats button
  async function handleFileStatsClick() 
  {
    await addMessageBox(`File Stats for ${selectedBinary}`, 'Hello world...');
  }

  // Handle clicking Strings button
  async function handleStringsClick() 
  {
    await addMessageBox(`Strings for ${selectedBinary}`, 'Hello world...');
  }

  // Handle clicking Call Graph button
  async function handleCallGraphClick() 
  {
    console.log("CALL GRAPH YAY");
  }
  
  // Handle selecting a new function
  async function handleFunctionChange(event) 
  {
    // Find the collection and binary objects
    const functionName = event.target.value;
    const currCollection = collectionMap.get(selectedCollection);
    const currBinary = currCollection.binaryMap.get(selectedBinary);

    // Indicate which function is chosen
    setSelectedFunction(functionName);

    const currFunction = Array.from(currBinary.functionMap.values())
        .find(func => func.name === functionName);

    // Enable/disable other UI elements as appropriate
    document.getElementById('DisassemblyButton').disabled = false;
    document.getElementById('DecompilationButton').disabled = false;
    document.getElementById('CFGButton').disabled = false;
  }

  // Handle clicking Disassembly button
  async function handleDisassemblyClick() 
  {
    await addMessageBox(`Disassembly for ${selectedBinary} / ${selectedFunction}`, 'Hello world...');
  }

  // Handle clicking Decompilation button
  async function handleDecompilationClick() 
  {
    await addMessageBox(`Decompilation for ${selectedBinary} / ${selectedFunction}`, 'Hello world...');
  }

  // Handle clicking CFG button
  async function handleCFGClick() 
  {
    console.log("CFG YAY");
  }
  

  /////////////////////////////////////////////
  // Code entry point
  /////////////////////////////////////////////

  // Executes upon every render. Sometimes twice (in dev mode). 
  useEffect(() => 
  {
    // Retrieve or create UUID for this session
    let storedUuid = sessionStorage.getItem('uuid');
    if (!storedUuid) 
    {
      storedUuid = uuidv4(); // Generate a new UUID
      storedUuid = storedUuid.replaceAll('-', '');
      sessionStorage.setItem('uuid', storedUuid); // Store it in sessionStorage
    }
    setUuid(storedUuid);    

    const sessionInitialized = sessionStorage.getItem('sessionInitialized');
    if (!sessionInitialized) 
    {
      // HACK: Temporarily disable to simplify debugging...
      // sessionStorage.setItem('sessionInitialized', true);
      initializeSession();
    }
  }, []); 
  // ABOVE: The list at the end of useEffect contains dependencies. 
  // Only re-run useEffect upon re-render if a dependency has changed.
  // Empty list means never re-run it. Missing list means always re-run it.


  /////////////////////////////////////////////
  // HTML
  /////////////////////////////////////////////

  return (
    <div className="App">
      <header className="App-header">
        <h1>CogBRE Web</h1>
      </header>
      <h2>Session UUID: {uuid}</h2>

      <button onClick={handleCloseSessionClick}>Close session</button> 
      <br />

      <b>Status message: </b>{statusMessage}

      <hr />
      <h3>Collection</h3>
      <div>
        <label htmlFor="dropdown">Choose a collection:</label>
        <select id="collectionDropdown" value={selectedCollection} onChange={handleCollectionChange}>
          <option value="" disabled>
            Select an option
          </option>
          {collectionNamesPulldown.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p>Selected collection: {selectedCollection}</p>
      </div>

      <hr />
      <h3>Binary File</h3>
      <div>
        <label htmlFor="dropdown">Choose a binary:</label>
        <select id="binaryDropdown" value={selectedBinary} onChange={handleBinaryChange}>
          <option value="" disabled>
            Select an option
          </option>
          {binaryNamesPulldown.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p>Selected binary: {selectedBinary}</p>
      </div>

      <button id="FileStatsButton" onClick={handleFileStatsClick}>File Status</button> 
      <button id="StringsButton" onClick={handleStringsClick}>Strings</button> 
      <button id="CallGraphButton" onClick={handleCallGraphClick}>Call Graph</button> 

      <hr />
      <h3>Function</h3>
      <div>
        <label htmlFor="dropdown">Choose a function:</label>
        <select id="functionDropdown" value={selectedFunction} onChange={handleFunctionChange}>
          <option value="" disabled>
            Select an option
          </option>
          {functionNamesPulldown.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p>Selected function: {selectedFunction}</p>
      </div>

      <button id="DisassemblyButton" onClick={handleDisassemblyClick}>Disassembly</button> 
      <button id="DecompilationButton" onClick={handleDecompilationClick}>Decompilation</button> 
      <button id="CFGButton" onClick={handleCFGClick}>CFG</button> 

      <hr />
      <h3>Text boxes</h3>
      <div>
        {messageBoxes.map((box) => (
          <MessageBox 
            key={box.id} 
            id={box.id} 
            title={box.title}
            message={box.message} 
            onRemove={removeMessageBox} 
          />
        ))}
      </div>
    </div>
  );
}

export default App;
