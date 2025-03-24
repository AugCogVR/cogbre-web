import React, { useState } from "react";

function QuestionChooser({ externalChange })
{
  // State to store the content of the notepad
  const [content, setContent] = useState("");

  // Function to handle pressing Q1 button
  function handleQ1()
  {
    setContent("Question 1:\n\nIn this program, an input is considered correct when a function that asks for an input returns that input value instead of zero. What specific input does the function part1a require to return a nonzero value?");

    // Call the function to notify an external entity of a change 
    if (externalChange)
    {
      externalChange("1");
    }
  };

  // Function to handle pressing Q2 button
  function handleQ2()
  {
    setContent("Question 2:\n\nWhat final value is returned by part1d when the input to part1a is correct?");

    // Call the function to notify an external entity of a change 
    if (externalChange)
    {
      externalChange("2");
    }
  };

  // Function to handle pressing Q3 button
  function handleQ3()
  {
    setContent("Question 3:\n\nWhat final value is returned by part3d when the input to part3a is correct?");

    // Call the function to notify an external entity of a change 
    if (externalChange)
    {
      externalChange("3");
    }
  };

  // Function to handle pressing Q4 button
  function handleQ4()
  {
    setContent("Question 4:\n\nWhat final value is returned by part4e when the required inputs are correct?");

    // Call the function to notify an external entity of a change 
    if (externalChange)
    {
      externalChange("4");
    }
  };

  // Function to handle pressing Q5 button
  function handleQ5()
  {
    setContent("Question 5:\n\nHow many times is the function part1a called if the part1d function fully executes (you examined this chain of functions in question 2)?");

    // Call the function to notify an external entity of a change 
    if (externalChange)
    {
      externalChange("5");
    }
  };

  // Function to handle pressing END button
  function handleEND()
  {
    setContent("Thank you for your participation!");

    // Call the function to notify an external entity of a change 
    if (externalChange)
    {
      externalChange("6");
    }
  };

  return (
    <div className="box">
      <h3>User Study Questions</h3>
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
        placeholder="Press Q1 button when directed"
      />
      <br />
      <button onClick={handleQ1}>Q1</button>
      <button onClick={handleQ2}>Q2</button>
      <button onClick={handleQ3}>Q3</button>
      <button onClick={handleQ4}>Q4</button>
      <button onClick={handleQ5}>Q5</button>
      <button onClick={handleEND}>END</button>
    </div>
  );
};

export default QuestionChooser;
