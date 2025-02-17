import React, { useState } from "react";

function Notepad({ externalChange })
{
  // State to store the content of the notepad
  const [content, setContent] = useState("");

  // Function to handle text area changes
  function handleChange(event) 
  {
    setContent(event.target.value);  // Update the state with new content

    // Call the function to notify an external entity of a change 
    // to this notepad instance. 
    if (externalChange)
    {
      externalChange(event.target.value);
    }
  };

  // Function to handle clearing the text area
  function handleClear()
  {
    setContent("");  // Clear the content state

      // Call the function to notify an external entity of a change 
      // to this notepad instance. 
      if (externalChange)
      {
        externalChange("");
      }
    };

  return (
    <div className="box">
      <h3>Notepad</h3>
      <textarea
        value={content}            // Controlled component with value tied to state
        style={{
            width: '500px',
            height: '150px',
            resize: 'none',
            overflowX: 'scroll',
            overflowY: 'scroll',
            marginBottom: '5px',
        }}
        onChange={handleChange}    // Call handleChange on user input
        placeholder="Type something here..."
      />
      <br />
      <button onClick={handleClear}>Clear</button>
    </div>
  );
};

export default Notepad;
