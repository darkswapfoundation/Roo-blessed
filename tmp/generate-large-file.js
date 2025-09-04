const fs = require('fs');
const path = require('path');

const filePath = 'tmp/large-file.js';
const stream = fs.createWriteStream(filePath);

stream.on('error', (err) => {
  console.error('Error writing to file:', err);
});

stream.on('finish', () => {
  console.log('Finished writing large file.');
});

// Write a large number of functions to the file
const numberOfFunctions = 3000;

stream.write('// This is a large file generated for testing purposes.\n\n');

for (let i = 1; i <= numberOfFunctions; i++) {
  const functionName = `myFunction_${i}`;
  const functionBody = `
/**
 * This is function number ${i}.
 * It has some comments to increase its size.
 * The purpose is to create a large file for testing diff application.
 */
function ${functionName}() {
  const a = ${i};
  const b = a * 2;
  const c = b + a;
  // Log the result for function ${i}
  console.log('Executing ${functionName}:', { a, b, c });
  return c;
}
`;
  stream.write(functionBody + '\n');
}

stream.end();