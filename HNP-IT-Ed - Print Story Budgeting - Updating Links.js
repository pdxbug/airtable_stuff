//This watches for new page plan updates and checks off the old page plans to keep
//a single, the latest, version in the page plan list

let inputConfig = input.config();

let table = base.getTable("Layout");
let view = table.getView("After Today - unsorted");
let query = await view.selectRecordsAsync(
  {
    fields: 
    [
      'Newsroom','Section','Page','Page ID','Desk','Page Type',
      'Edition','Created','Update Times','Update Files','Pubdate',
      'Template Status','Template List', 'XML Status'
    ],
    sorts: [
       {field: "Created"},
    ]
  },
);
//console.log(inputConfig);
for (let record of query.records) {
  if(record.id !== `${inputConfig.thisRecordId}`) {
    if (`${record.getCellValueAsString("Newsroom")}` == `${inputConfig.thisNewsroom}` &&
      `${record.getCellValueAsString("Section")}` == `${inputConfig.thisSection}` &&
      (`${record.getCellValue("Page ID")}` == `${inputConfig.thisPageId}` ||
       `${record.getCellValue("Page")}` == `${inputConfig.thisPage}`) &&
      //`${record.getCellValueAsString("Desk")}` == `${inputConfig.thisDesk}` &&
      //`${record.getCellValueAsString("Page Type")}` == `${inputConfig.thisSubDesk}` &&
      `${record.getCellValue("Edition")}` == `${inputConfig.thisEdition}` &&
      `${record.getCellValue("Pubdate")}` == `${inputConfig.thisPubdate}`
    ) {
      if (`${record.getCellValue("Created")}` < `${inputConfig.thisCreatedTime}`) {
        console.log("found a match! "+record.id);
        //update the match Updated to true
        table.updateRecordAsync(record.id, {
            "Updated": true,
        });
        console.log("Updated to true");
        //get the match Created time, Updated Times and put into new records Updated Times
        let updatedTimes = '';
        if (`${record.getCellValueAsString("Update Times")}` !== "") {
          updatedTimes = `${record.getCellValueAsString("Update Times")}`+',';
        }
        updatedTimes = updatedTimes+`${inputConfig.thisCreatedTime}`;
        console.log(updatedTimes);
        //get the match Update Files names put into new records Update Files
        let updateFiles = '';
        if (`${record.getCellValueAsString("Update Files")}` !== "") {
          updateFiles = `${record.getCellValueAsString("Update Files")}`+',';
        }
        updateFiles = updateFiles+`${inputConfig.thisFilename}`;
        console.log(updateFiles);
        let originalTemplateStatus = `${record.getCellValueAsString("Template Status")}`;
        let templateStatus = null;
        let templateList = null;
        let xmlStatus = {name: 'Waiting'};
        console.log(originalTemplateStatus);
        if (originalTemplateStatus != '') {
          if (originalTemplateStatus == 'LOCKED') {
            let cellValue = record.getCellValue("Template List");
            // console.log(cellValue);
            if (cellValue && cellValue[0]) {
              templateList = [{id:cellValue[0].id}];
            }
            let cellValue1 = `${record.getCellValueAsString("XML Status")}`;
            xmlStatus = {name:cellValue1};
          }
          templateStatus = {name: originalTemplateStatus};
        }
        console.log(templateStatus);
        console.log(templateList);
        table.updateRecordAsync(`${inputConfig.thisRecordId}`, {
            "Update Times": updatedTimes,
            "Update Files": updateFiles,
            "Template Status": templateStatus,
            "Template List": templateList,
            "XML Status": xmlStatus
        });
      } else {
        console.log("REVERSE MATCH: found a match! "+record.id);
        //update the match Updated to true
        table.updateRecordAsync(`${inputConfig.thisRecordId}`, {
            "Updated": true,
        });
        console.log("Updated older record to true");
      }
    }
  }
}

//update the newsroom link to show plans exist
//will need to be an updated time and formula for the interface display
let linkTable = base.getTable("Links to Pages");
let linkQuery = await linkTable.selectRecordsAsync(
  {
    fields: 
    [
      'Pubdate','Cue Abbr'
    ],
    sorts: [
       {field: "Pubdate", direction: "asc"},
       {field: "Cue Abbr"},
    ]
  },
);

let thisPubdate = `${inputConfig.thisPubdate}`;
let thisNewsroom = `${inputConfig.thisNewsroom}`;
for (let linkRecord of linkQuery.records) {
  let recordId = linkRecord.id;
  let recordPubdate = `${linkRecord.getCellValueAsString("Pubdate")}`;
  let recordNewsroom = `${linkRecord.getCellValueAsString("Cue Abbr")}`;
  if (recordPubdate > thisPubdate) {
    //break out of loop as we are past the pubdate
    console.log('past pubdate for link check - breaking');
    console.log(`Record: ${linkRecord.getCellValueAsString("Pubdate")}`);
    console.log(`this: ${inputConfig.thisPubdate}`);
    break;
  }
  //go through the links until we find by pubdate and cueabbr or go past the pubdate
  if (
    recordPubdate == thisPubdate &&
    recordNewsroom == thisNewsroom
  ) {
    console.log('link record found! '+recordId+' - updating time and stopping');
    console.log('record pubdate '+recordPubdate+' - newsroom '+recordNewsroom);
    console.log('this pubdate '+thisPubdate+' - newsroom '+thisNewsroom);
    let now = new Date();
    linkTable.updateRecordAsync(recordId, {
      "Latest Plan": now,
      "Updated Plan": `${inputConfig.thisFilename}`
    });
    break;
  }
}
