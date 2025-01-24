import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
// import logo from './logo.svg';
import './App.css';
// import DictionaryTable from './components/DictionaryTable';
import { OxideCollection, OxideBinary, OxideFunction, OxideBasicBlock, OxideInstruction } from './models/OxideCollection.js';

function App() 
{
  // State: variables whose state changes cause app re-render
  const [uuid, setUuid] = useState('');
  const [debuggingMessage, setDebuggingMessage] = useState('');

  const [collectionNamesPulldown, setCollectionNamesPulldown] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  
  const [binaryNamesPulldown, setBinaryNamesPulldown] = useState([]);
  const [selectedBinary, setSelectedBinary] = useState('');

  const [functionNamesPulldown, setFunctionNamesPulldown] = useState([]);
  const [selectedFunction, setSelectedFunction] = useState('');

  const [collectionMap, setCollectionMap] = useState(null);

  // Refs: variables whose state is preserved across re-renders
  // const testButtonCounter = useRef(0);

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

  // Set a debug message on the page
  function debugMessage(message) 
  {
    setDebuggingMessage(message + '\n' + debuggingMessage);
  }

  // Initialize the sesison with Nexus, get the list of collections,
  // and populate the UI with collection list.
  async function initializeSession() 
  {
    // Initialize the session
    const initResponse = await nexusSync(['session_init_web', {}]);
    debugMessage('Session init: ' + JSON.stringify(initResponse));

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

    debugMessage('Collections: ' + sortedCollectionNames);
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
  async function ensureBinaryInfo(binary) 
  {
    // INSTRUCTIONS
    if (binary.instructionDict == null) 
    {
      // Pull the disassembly into a dict of instructions, keyed by offset
      binary.instructionDict = new Map();
      const disassemblyJsonString = await nexusSync(['oxide_get_disassembly', binary.oid]);

      if (disassemblyJsonString) 
      {
        const disassemblyJson = JSON.parse(disassemblyJsonString)[binary.oid].instructions;
        for (const [offset, value] of Object.entries(disassemblyJson)) 
        {
          // Create new instruction object and add to dictionary
          const str = value.str;
          const instruction = new OxideInstruction(offset, str);
          const instructionDictKey = parseInt(offset);
          binary.instructionDict.set(instructionDictKey, instruction);
          // Set additional values
          instruction.mnemonic = value.mnemonic;
          instruction.op_str = value.op_str;
        }
      }
    }
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
    const sortedFunctionNames = Array.from(currBinary.functionMap.keys()).sort();
    setFunctionNamesPulldown(sortedFunctionNames);
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
  }

  // Handle clicking the close session button
  async function handleCloseSessionClick() 
  {
    nexusSync(['session_close'])
    .then((responseData) => 
    {
      debugMessage('Session close: ' + JSON.stringify(responseData));
      setUuid("");
    });
  }
  

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


  return (
    <div className="App">
      <header className="App-header">
        <h1>CogBRE Web</h1>
      </header>
      <h2>Session UUID: {uuid}</h2>

      <div>
        <label htmlFor="dropdown">Choose a collection:</label>
        <select id="dropdown" value={selectedCollection} onChange={handleCollectionChange}>
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

      <div>
        <label htmlFor="dropdown">Choose a binary:</label>
        <select id="dropdown" value={selectedBinary} onChange={handleBinaryChange}>
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

      <div>
        <label htmlFor="dropdown">Choose a function:</label>
        <select id="dropdown" value={selectedFunction} onChange={handleFunctionChange}>
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

      <button onClick={handleCloseSessionClick}>Close session</button> 

      <h3>--------------------------------------------</h3>
      <h3>Debugging messages</h3>
      <p><pre>{debuggingMessage}</pre></p> 
    </div>
  );
}

export default App;
