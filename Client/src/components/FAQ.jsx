import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const FAQ = () => {
  return (
    <div>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">What is end-to-end encryption?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body1" gutterBottom>
            All of your video and audio data is end-to-end encrypted using WebRTC's built-in encryption, ensuring your privacy during meetings.
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">What programming languages can I use in the code editor?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body1" paragraph>
            Our collaborative code editor supports multiple programming languages, including:
          </Typography>
          <ul>
            <li><Typography variant="body1">JavaScript - Full execution support</Typography></li>
            <li><Typography variant="body1">Python - Simulated execution</Typography></li>
            <li><Typography variant="body1">Java - Simulated execution</Typography></li>
            <li><Typography variant="body1">C++ - Simulated execution</Typography></li>
            <li><Typography variant="body1">C# - Simulated execution</Typography></li>
            <li><Typography variant="body1">TypeScript, PHP, Ruby, Go, and Swift - Basic syntax highlighting only</Typography></li>
          </ul>
          <Typography variant="body1" paragraph>
            For JavaScript, we provide full execution support. For Python, Java, C++, and C#, we offer simulated execution that demonstrates how the code would behave. Other languages currently have syntax highlighting only.
          </Typography>
          <Typography variant="body1">
            You can use the input field below the editor to provide input values for your code. Each line in the input field represents one input value.
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">How does the code execution work?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body1" paragraph>
            When you click the "Run" button, your code is sent to our server for execution. For JavaScript, we run your code in a sandboxed environment. For other languages (Python, Java, C++, C#), we provide a simulated execution that shows approximately what the output would be.
          </Typography>
          <Typography variant="body1" paragraph>
            The code execution feature is designed for educational purposes and basic demonstrations. It has the following limitations:
          </Typography>
          <ul>
            <li><Typography variant="body1">Limited library support - only built-in libraries are available</Typography></li>
            <li><Typography variant="body1">No file system access for security reasons</Typography></li>
            <li><Typography variant="body1">Execution time is limited to prevent resource abuse</Typography></li>
            <li><Typography variant="body1">For non-JavaScript languages, the execution is simulated and not a real compiler/interpreter</Typography></li>
          </ul>
          <Typography variant="body1">
            These limitations are in place to ensure security and stability of the platform.
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">How do I provide input to my code?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body1" paragraph>
            To provide input to your code:
          </Typography>
          <ol>
            <li><Typography variant="body1">Enter your input values in the "Input" text area below the code editor</Typography></li>
            <li><Typography variant="body1">Each line represents one input value</Typography></li>
            <li><Typography variant="body1">When your code requests input (e.g., using <code>prompt()</code> in JavaScript, <code>input()</code> in Python, or <code>Scanner</code> in Java), the system will read from these values sequentially</Typography></li>
          </ol>
          <Typography variant="body1" paragraph>
            For example, if your Python code has two <code>input()</code> calls and you've entered:
          </Typography>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
            {'John\n25'}
          </pre>
          <Typography variant="body1">
            The first <code>input()</code> call will receive "John" and the second will receive "25".
          </Typography>
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default FAQ; 