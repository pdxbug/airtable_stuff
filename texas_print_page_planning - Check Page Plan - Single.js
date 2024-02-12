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
      'Template Status','Previous Template Status','Template List',
      'XML Status','Stories','Jumps','Photos','Override Stories',
      'Notes','Previous Template'
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
      `${record.getCellValue("Edition")}` == `${inputConfig.thisEdition}` &&
      `${record.getCellValue("Pubdate")}` == `${inputConfig.thisPubdate}`
    ) {
      if (
        `${record.getCellValue("Created")}` < `${inputConfig.thisCreatedTime}` &&
        `${record.getCellValueAsString("Template Status")}` != 'LOCKED' &&
        `${record.getCellValueAsString("Template Status")}` != 'Send to CUE'
      ) {
        console.log("found an older match that wasn't locked/sent! "+record.id);
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
        let notes = `${record.getCellValueAsString("Notes")}`;
        let stories = `${record.getCellValueAsString("Stories")}`;
        let photos = `${record.getCellValueAsString("Photos")}`;
        let jumps = `${record.getCellValueAsString("Jumps")}`;
        let overideStories = `${record.getCellValueAsString("Override Stories")}`;
        let previousTemplateStatus = `${record.getCellValueAsString("Previous Template Status")}`;
        let templateStatus = null;
        let templateList = null;
        let previousTemplate = null;
        let xmlStatus = {name: 'Waiting'};
        console.log(originalTemplateStatus);
        if (originalTemplateStatus != '') {
          if (originalTemplateStatus == 'LOCKED') {
            let templateListValue = record.getCellValue("Template List");
            let previousTemplateValue = record.getCellValue("Previous Template");
            // console.log(cellValue);
            if (templateListValue && templateListValue[0]) {
              templateList = [{id:templateListValue[0].id}];
            }
            if (previousTemplateValue && previousTemplateValue[0]) {
              previousTemplate = [{id:previousTemplateValue[0].id}];
            }
            let xmlStatusValue = `${record.getCellValueAsString("XML Status")}`;
            xmlStatus = {name:xmlStatusValue};
          }
          templateStatus = {name: originalTemplateStatus};
        }
        let update = {
          "Update Times": updatedTimes,
          "Update Files": updateFiles,
          "Template Status": templateStatus,
          "Notes": notes,
          "Stories": parseInt(stories),
          "Jumps": parseInt(jumps),
          "Photos": parseInt(photos),
          "Override Stories": parseInt(overideStories),
          "Previous Template Status": previousTemplateStatus,
          "XML Status": xmlStatus
        };
        console.log(templateStatus);
        console.log(templateList);
        if (templateList != null) {
          update["Template List"] = templateList
        }
        if (previousTemplate != null) {
          update["Previous Template"] = previousTemplate
        }
        console.log(update);
        table.updateRecordAsync(
          `${inputConfig.thisRecordId}`, 
          update
        );
      } else {
        if (`${record.getCellValue("Created")}` < `${inputConfig.thisCreatedTime}`) {
          console.log("REVERSE MATCH: found a match! "+record.id);
        } else {
          console.log("Record was sent or locked! "+record.id);
        }
        //update the match Updated to true
        table.updateRecordAsync(`${inputConfig.thisRecordId}`, {
            "Updated": true,
        });
        console.log("Updated older record to true");
      }
    }
  }
}
