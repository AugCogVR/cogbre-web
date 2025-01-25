import React, { useState } from "react";

function Notepad()
{
  // State to store the content of the notepad
  const [content, setContent] = useState("");

  // Function to handle text area changes
  function handleChange(event) 
  {
    setContent(event.target.value);  // Update the state with new content
  };

  // Function to handle clearing the text area
  function handleClear()
  {
    setContent("");  // Clear the content state
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
