import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
// import logo from './logo.svg';
import './App.css';
// import DictionaryTable from './DictionaryTable';


function App() {

  // State: variables whose state changes cause app re-render
  const [uuid, setUuid] = useState('');
  const [debuggingMessage, setDebuggingMessage] = useState('');
  const [oxideCollectionNames, setOxideCollectionNames] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedCID, setSelectedCID] = useState('');
  const [selectedCollectionOIDs, setSelectedCollectionOIDs] = useState([]);

  // Refs: variables whose state is preserved across re-renders
  // const testButtonCounter = useRef(0);

  // Test if an object is empty (this is not built into Javascript...)
  function isEmpty(obj) {
    return Object.keys(obj).length === 0;
  }

  // Post a command to Nexus and return the response.
  const nexusSync = async (commandList) => {
    try {
      const payload = { 
        sessionId: sessionStorage.getItem('uuid'), 
        command: commandList 
      };
      console.log('Nexus sync payload:', payload);

      const response = await fetch('/client_sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',  
        },
        body: JSON.stringify(payload), 
      });
      if (!response.ok) {
        throw new Error(`Failed to sync with API: ${response.statusText}`);
      }
      const responseJson = response.json();
      console.log('Nexus sync response:', responseJson);
      return responseJson;
    } catch (error) {
      console.error('Error posting client sync:', error);
      throw error;
    }
  }

  const debugMessage = (message) => {
    setDebuggingMessage(message + '\n' + debuggingMessage);
  }

  // Handle clicking the close session button
  const handleCloseSessionClick = async () => {
    nexusSync(['session_close'])
    .then((responseData) => {
      debugMessage('Session close: ' + JSON.stringify(responseData));
    });
  };

  // Handle selecting a new collection
  const handleCollectionChange = (event) => {
    const collection = event.target.value;
    setSelectedCollection(collection);

    // Get the collection's CID
    nexusSync(['oxide_get_cid_from_name', collection])
    .then((responseData) => {
      const selectedCIDTemp = JSON.parse(responseData)
      setSelectedCID(selectedCIDTemp);
      // debugMessage('CID: ' + responseData);

      // Get the OIDs associated with the CID
      nexusSync(['oxide_get_oids_with_cid', selectedCIDTemp])
      .then((responseData) => {
        setSelectedCollectionOIDs(JSON.parse(responseData));
        debugMessage('Collection OIDs: ' + responseData);
      });
    });


  };

  // Executes upon every render. Sometimes twice (in dev mode). 
  useEffect(() => {
    // Retrieve or create UUID for this session
    let storedUuid = sessionStorage.getItem('uuid');
    if (!storedUuid) {
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

      // Initialize the session
      nexusSync(['session_init_web', {}])
        .then((responseData) => {
          debugMessage('Session init: ' + JSON.stringify(responseData));
        });

      // Get collections
      nexusSync(['oxide_collection_names'])
        .then((responseData) => {
          setOxideCollectionNames(JSON.parse(responseData));
          debugMessage('Collections: ' + responseData);
        });
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
          {oxideCollectionNames.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p>Selected collection: {selectedCollection}</p>
      </div>

      <button onClick={handleCloseSessionClick}>Close session</button> 

      <h3>--------------------------------------------</h3>
      <h3>Debugging messages</h3>
      <p><pre>{debuggingMessage}</pre></p> 
    </div>
  );
}

export default App;
