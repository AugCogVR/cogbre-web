class OxideBinary {
  constructor(oid, name, size) {
    this.oid = oid;
    this.name = name;
    this.size = size;

    // Initialize the dictionaries as empty Maps (can use plain objects too)
    this.functionDict = new Map(); // For functions indexed by offset
    this.basicBlockDict = new Map(); // For basic blocks indexed by offset
    this.instructionDict = new Map(); // For instructions indexed by offset
    this.decompMapDict = new Map(); // For decompiled code indexed by offset and line number

    // Parent collection (will be set later)
    this.parentCollection = null;
  }

  // toString() {
  //   let output = `OID: ${this.oid} || Name: ${this.name} || Size: ${this.size}`;

  //   // Add meaningful output for remaining fields if necessary
  //   if (this.functionDict.size > 0) {
  //     output += ` || Function Count: ${this.functionDict.size}`;
  //   }
  //   if (this.basicBlockDict.size > 0) {
  //     output += ` || Basic Block Count: ${this.basicBlockDict.size}`;
  //   }
  //   if (this.instructionDict.size > 0) {
  //     output += ` || Instruction Count: ${this.instructionDict.size}`;
  //   }
  //   if (this.decompMapDict.size > 0) {
  //     output += ` || Decompiled Code Count: ${this.decompMapDict.size}`;
  //   }

  //   return output;
  // }
}

export default OxideBinary;
