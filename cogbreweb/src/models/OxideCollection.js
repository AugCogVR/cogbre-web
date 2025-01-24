class OxideCollection {
  constructor(collectionId, name, notes, binaryMap) {
    this.collectionId = collectionId;
    this.name = name;
    this.notes = notes;
    this.binaryMap = binaryMap;
  }

  // toString() {
  //   let output = `CID: ${this.collectionId} || Name: ${this.name} || Notes: ${this.notes}`;
  //   if (this.binaryList && this.binaryList.length > 0) {
  //     output += "\n\t->Binaries\n";
  //     this.binaryList.forEach(binary => {
  //       output += `\t${binary.toString()}\n`;
  //     });
  //   }
  //   return output;
  // }
}

export default OxideCollection;
