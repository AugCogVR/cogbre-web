import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';
import
{ 
  nexusSync,
  retrieveTextForArbitraryModule,
  initializeNexusSession,
  buildCollectionMap,
  buildBinaryMap,
  ensureBinaryInfo,
} from './models/NexusClient';
import Notepad from './components/Notepad';
import MessageBox from './components/MessageBox';
import ImageBox from './components/ImageBox';


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
  const [imageBoxes, setImageBoxes] = useState([]);

  // Refs: variables whose state is preserved across re-renders
  // const example = useRef();


  /////////////////////////////////////////////
  // Various support functions
  /////////////////////////////////////////////

  // Initialize the session with Nexus, get the list of collections,
  // and populate the UI with collection list.
  async function initializeWebSession() 
  {
    initializeNexusSession();

    const collectionMap = await buildCollectionMap();
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
  }

  // Remove a message box by ID
  function removeMessageBox(id) 
  {
    setMessageBoxes(messageBoxes.filter((box) => box.id !== id));
  }

  // Add a new image box 
  function addImageBox(title, imageUrl)
  {
    const newImageBox = 
    {
      id: Date.now(), // Use current timestamp as unique ID
      title: title,
      imageUrl: imageUrl,
    };
    setImageBoxes([...imageBoxes, newImageBox]);
    console.log("IMAGE BOX: ", imageUrl);
  }

  // Remove an image box by ID
  function removeImageBox(id)
  {
    setImageBoxes(imageBoxes.filter((box) => box.id !== id));
  }

  // Test if an object is empty (this is not built into Javascript...?)
  function isEmpty(obj) 
  {
    return Object.keys(obj).length === 0;
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
    const currCollection = collectionMap.get(selectedCollection);
    const currBinary = currCollection.binaryMap.get(selectedBinary);
    let contents = await retrieveTextForArbitraryModule('file_stats', currBinary.oid, {}, true);
    await addMessageBox(`File Stats for ${selectedBinary}`, contents);    
  }

  // Handle clicking Strings button
  async function handleStringsClick() 
  {
    const currCollection = collectionMap.get(selectedCollection);
    const currBinary = currCollection.binaryMap.get(selectedBinary);
    let contents = await retrieveTextForArbitraryModule('strings', currBinary.oid, {}, true);
    await addMessageBox(`Strings for ${selectedBinary}`, contents);    
  }

  // Handle clicking Call Graph button
  async function handleCallGraphClick() 
  {
    const currCollection = collectionMap.get(selectedCollection);
    const currBinary = currCollection.binaryMap.get(selectedBinary);
    const imageUrl = `/images/${currBinary.oid}-callgraph.png`;
    console.log("IMAGE BOX: ", imageUrl);
    await addImageBox(`Call Graph for ${selectedBinary}`, imageUrl);
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

    // Enable/disable other UI elements as appropriate
    document.getElementById('DisassemblyButton').disabled = false;
    document.getElementById('DecompilationButton').disabled = false;
    document.getElementById('CFGButton').disabled = false;
  }

  // Handle clicking Disassembly button
  async function handleDisassemblyClick() 
  {
    const currCollection = collectionMap.get(selectedCollection);
    const currBinary = currCollection.binaryMap.get(selectedBinary);
    const currFunction = Array.from(currBinary.functionMap.values())
        .find(func => func.name === selectedFunction);

    let markedUp = ''; // Initialize the string to build the HTML-formatted markup
    let plainText = ''; // Initialize the string to build the plain text output

    // Iterate over each basic block in the function's basicBlockMap
    currFunction.basicBlockMap.forEach((basicBlock, key) => 
    {
      // Iterate over each instruction in the basic block's instructionMap
      basicBlock.instructionMap.forEach((instruction, key) => 
      {
        // Append formatted text for markup (HTML)
        markedUp += `<color=#777777>${instruction.offset} <color=#99FF99>${instruction.mnemonic} <color=#FFFFFF>${instruction.op_str}\n`;
        // Append plain text for non-markup version
        plainText += `${instruction.offset} ${instruction.mnemonic} ${instruction.op_str}\n`;
      });

      // Add separator between blocks in the markup version
      markedUp += `<color=#000000>------------------------------------\n`;
    });

    // console.log("DISASSEMBLY: ", markedUp);
    await addMessageBox(`Disassembly for ${selectedBinary} / ${selectedFunction}`, plainText);
  }

  // Handle clicking Decompilation button
  async function handleDecompilationClick() 
  {
    const currCollection = collectionMap.get(selectedCollection);
    const currBinary = currCollection.binaryMap.get(selectedBinary);
    const currFunction = Array.from(currBinary.functionMap.values())
        .find(func => func.name === selectedFunction);

    let markedUp = ''; // Initialize the string to build the HTML-formatted markup
    let plainText = ''; // Initialize the string to build the plain text output

    let indentLevel = 0;

    // Iterate over each line of decompiled code in the function
    const sortedKeys = Array.from(currFunction.decompMap.keys()).sort((a, b) => a - b);
    sortedKeys.forEach(key =>
    {
      const decompLine = currFunction.decompMap.get(key);
      const code = decompLine.code;

      if (code.includes('}')) 
      {
        indentLevel--; // Quick & dirty indenting
      }
    
      markedUp += `<color=#777777>`;
    
      // Add the necessary indentation
      for (let i = 0; i < indentLevel; i++) 
      {
        markedUp += "    "; // Quick & dirty indenting
        plainText += "    "; // Quick & dirty indenting
      }
    
      markedUp += `<color=#FFFFFF>${code}`;
      plainText += `${code}`;
    
      // Handle associated instructions
      decompLine.associatedInstructionMap.forEach((instruction, offset) =>
      {
        markedUp += `<color=#AAAA00> |${offset}|`;
      });
    
      markedUp += '\n';
      plainText += '\n';
    
      if (code.includes('{')) 
      {
        indentLevel++; // Quick & dirty indenting
      }
    });

    // console.log("DECOMPILATION: ", markedUp);
    await addMessageBox(`Decompilation for ${selectedBinary} / ${selectedFunction}`, plainText);
  }

  // Handle clicking CFG button
  async function handleCFGClick() 
  {
    console.log('CFG YAY');
  }
  

  /////////////////////////////////////////////
  // Page rendering
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
      initializeWebSession();
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

      <div className="column-container">
        <div className="column">
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
            <p>Selected collection: <b>{selectedCollection}</b></p>
          </div>
        </div>

        <div className="column">
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
            <p>Selected binary: <b>{selectedBinary}</b></p>
          </div>
          <button id="FileStatsButton" onClick={handleFileStatsClick}>File Stats</button> 
          <button id="StringsButton" onClick={handleStringsClick}>Strings</button> 
          <button id="CallGraphButton" onClick={handleCallGraphClick}>Call Graph</button> 
        </div>

        <div className="column">
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
            <p>Selected function: <b>{selectedFunction}</b></p>
          </div>
          <button id="DisassemblyButton" onClick={handleDisassemblyClick}>Disassembly</button> 
          <button id="DecompilationButton" onClick={handleDecompilationClick}>Decompilation</button> 
          <button id="CFGButton" onClick={handleCFGClick}>CFG</button> 
        </div>
      </div>

      <hr />

      <Notepad />

      <hr />

      <h3>Text boxes</h3>
      <div className="box-container">
        {messageBoxes.map((box) => (
          <MessageBox 
            key={box.id} 
            id={box.id} 
            title={box.title}
            message={box.message} 
            onRemove={() => removeMessageBox(box.id)} 
          />
        ))}
      </div>

      <hr />

      <h3>Graphs</h3>
      <div className="box-container">
        {imageBoxes.map((box) => (
          <ImageBox
            key={box.id}
            title={box.title}
            imageUrl={box.imageUrl}
            onRemove={() => removeImageBox(box.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
