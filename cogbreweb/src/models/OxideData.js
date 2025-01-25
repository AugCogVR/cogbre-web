class OxideCollection 
{
  constructor(collectionId, name) 
  {
    this.collectionId = collectionId;
    this.name = name;
    this.notes = null;
    this.binaryMap = null;
  }
}

class OxideBinary 
{
  constructor(oid, name, size) 
  {
    this.oid = oid;
    this.name = name;
    this.size = size;
    this.functionMap = null; // For functions indexed by offset
    this.basicBlockMap = null; // For basic blocks indexed by offset
    this.instructionMap = null; // For instructions indexed by offset
    this.decompMap = null; // For decompiled code indexed by offset and line number
    this.parentCollection = null;
  }
}

class OxideFunction 
{
  constructor(name, offset, signature) 
  {
    this.name = name;
    this.offset = offset;
    this.signature = signature;
    this.basicBlockMap = new Map(); 
    this.paramsList = [];
    this.retType = '';
    this.returning = false;
    this.parentBinary = null;
    this.sourceFunctionMap = new Map();
    this.targetFunctionMap = new Map();
    this.decompDict = new Map();
    this.capaList = [];
  }
}

class OxideBasicBlock 
{
  constructor(offset) 
  {
    this.offset = offset;
    this.instructionMap = new Map();  
    this.sourceBasicBlockMap = new Map();
    this.targetBasicBlockMap = new Map();
    this.destinationAddressList = [];
    this.parentFunction = null;
  }
}

class OxideInstruction 
{
  constructor(offset, str) 
  {
    this.offset = offset;
    this.str = str;
    this.mnemonic = '';    // Placeholder, can be set externally
    this.op_str = '';      // Placeholder, can be set externally
    this.parentBlock = null; // Placeholder, can be set externally
  }
}

export 
{ 
  OxideCollection, 
  OxideBinary, 
  OxideFunction, 
  OxideBasicBlock, 
  OxideInstruction 
};

