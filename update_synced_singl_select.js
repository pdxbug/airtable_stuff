const {
    thisPageNo,
    thisRecordId,
    thisPubdate,
    thisPublication,
    debug,
} = input.config();

function getPubDate(pubdate) {
    const date = new Date(pubdate);
    let day = date.getDate().toString()//.padStart(2, "0");
    let month = (date.getMonth() + 1).toString()//.padStart(2, "0");
    let year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// helper function (provided by Airtable)
// This creates a map object of primary field and record ID
// this is used to create a simple way of matching against existing records
// example: { FeatureX-AccountY: "recWer23radda" }
const createMappingOfUniqueFieldToRecordId = function (records, fieldName) {
  const mapping = {}
  for (const existingRecord of records) {
    let fieldname = existingRecord.getCellValueAsString(fieldName);
    let pageId = existingRecord.getCellValueAsString('Page ID');
    mapping[fieldname] = pageId
  }
  return mapping
}

let thisTable = base.getTable('Print Pages');
let recordsQuery = await thisTable.selectRecordsAsync(
    {
        fields: ["page_designation","Page ID"],
        sorts: [
            {field: "page_designation"}
        ]
    }
);

let mapOfPages = createMappingOfUniqueFieldToRecordId(recordsQuery.records, 'page_designation');

//page_designation example
// 2/21/2024|Bay Area Citizen|A|11
const alphaRegex = /[A-Z]+/g;
const numericRegex = /[0-9]+/g;
let section = thisPageNo.match(alphaRegex);
let pageNo = thisPageNo.match(numericRegex);

console.log('section');
console.log(section);
console.log('pageNo');
console.log(pageNo);
console.log('thisPubdate');
console.log(getPubDate(thisPubdate));
console.log('thisPublication');
console.log(thisPublication);

let matchPageDes = getPubDate(thisPubdate)+'|'+thisPublication+'|'+section+'|'+pageNo;
console.log(matchPageDes);

if (mapOfPages[matchPageDes] !== undefined){
  console.log('page exists in CUE, updating Budget info with logical page name');
  let budgetTable = base.getTable('WCM to Cue Print Budgeting');
  console.log(mapOfPages[matchPageDes]);
  budgetTable.updateRecordAsync(thisRecordId, {"Layout Page": {name:mapOfPages[matchPageDes]}});
} else {
  //it doesn't exist, we need to update notification and put a warning!
}
