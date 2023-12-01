// each time this runs, it needs to clear the old counts and recount? Discuss with Ian
// we need to add a time for when was last time counts updated for visibility and confirmation
// every 5 mins?

let inputConfig = input.config();
let thisBase = `${inputConfig.thisBase}`;
let thisView = `${inputConfig.thisView}`;

let table = base.getTable(thisBase);
let view = table.getView(thisView);

//example A A1 or A Opinion or B Business
const pageRegex0 = /^[A-Z] ([A-Z](|[0-9])[0-9])/g; //A A1
const pageRegex1 = /^[A-Z] [A-Za-z0-9. ]+/g; //A Opinion
const pageRegex2 = /^[A-Z.](|[0-9])[0-9]/g; //A10

let queryResult = await view.selectRecordsAsync({
    fields: ["Publication", "Print Page", "Page No.", "Print Pub Date"],
    sorts: [
       // sort by "filename" in ascending order
       {field: "Print Pub Date"},
       {field: "Publication"},
       {field: "Print Page"},
       {field: "Page No."}
    ]
});

let pages = {};
let publication = '';

for (let record of queryResult.records) {
    if (publication !== `${record.getCellValueAsString("Print Pub Date")}|${record.getCellValueAsString("Publication")}`) {
        //reset the publication and variables
        publication = `${record.getCellValueAsString("Print Pub Date")}|${record.getCellValueAsString("Publication")}`;
        pages[publication] = {}
        pages[publication]['unassigned'] = 0;
        pages[publication]['total'] = 0;
    }
    let printPage = `${record.getCellValueAsString("Print Page")}`;
    let pageNo = `${record.getCellValueAsString("Page No.")}`;
    let section = '';
    let page = 0;
    let pageInfo = [];
    pages[publication]['total'] = pages[publication]['total']+1;
    if (printPage == "" &&
        pageNo == "") {
            pages[publication]['unassigned'] = pages[publication]['unassigned']+1;
            continue;
    } else if (printPage != "" &&
        pageNo == "") {
            // console.log(printPage);
            //we want to pull the page letter and number if available (regex)
            //expectations:
            // A A1
            // A Opinion
            // B Business
            if (printPage.match(pageRegex0) !== null) {
                pageInfo = printPage.match(pageRegex0)+'';
                let pageInfoArray = pageInfo.split(' ')
                section = pageInfoArray[0];
                page = '|'+pageInfoArray[1].match(/[0-9]+$/);
            } else if (printPage.match(pageRegex1) !== null) {
                pageInfo = printPage.match(pageRegex1)+'';
                // console.log('here!!!');
                // console.log(printPage);
                // console.log(pageInfo);
                section = pageInfo.match(/^[A-Z]+/)+'';
                page = '|'+pageInfo.replace(/^[A-Z]+ /,'').trim();
                // console.log(section);
                // console.log(page);
            } else if (printPage.match(pageRegex2) !== null) {
                pageInfo = printPage.match(pageRegex2)+'';
                // console.log('here!!!');
                // console.log(printPage);
                // console.log(pageInfo);
                section = pageInfo.match(/^[A-Z]+/)+'';
                page = '|'+pageInfo.replace(/^[A-Z]+/,'').trim();
                //console.log(section);
                //console.log(page);
            }  else {
                console.log('unknown: '+printPage+' | '+pageNo);
                console.log('section: '+section+' page: '+page);
                section = 'unknown-';
            }
    } else if (printPage != "" &&
        pageNo != "") {
            //console.log(printPage);
            //console.log(pageNo);
            //check the page no. first to see if it includes letter and numbers
            if (pageNo.match(pageRegex2) !== null) {
                //if it is like B12, we have section and page
                //otherwise it will just have page number and section letter will be in printPage
                section = pageNo.match(/^[A-Z.]/);
                page = "|"+pageNo.match(/[0-9]+$/);
            } else if (pageNo.match(/[0-9]+/) !== null) {
                //just the page numbers, get the section letter from the printPage
                section = printPage[0];
                page = "|"+pageNo.match(/[0-9]+/);
            } else {
                console.log('WE SHOULD NOT BE HERE!');
                console.log('page: '+printPage);
                console.log('number: '+pageNo);
            }
            //console.log(`${record.getCellValueAsString("Print Page")}`);
            //we want to pull the page letter and number if available (regex)
    } else {
        console.log('we should not be here! Record:'+record.id);
        continue;
    }
    if (typeof pages[publication][section+page] == "undefined") {
        pages[publication][section+page] = 1;
    } else {
        pages[publication][section+page] += 1;
    }
    //console.log(`Page: ${record.getCellValueAsString("Print Page")} - No: ${record.getCellValueAsString("Page No.")}`);
}

//get a list of the story counts and see if we need to update or enter a new one
const createMappingOfUniqueFieldToRecordId = function (records, fieldName) {
  const mapping = {}
  for (const existingRecord of records) {
    mapping[existingRecord.getCellValueAsString(fieldName)] = existingRecord.id
  }
  return mapping
}

let storyCountTable = await base.getTable("Story Page Counts");
let todayCountView = await storyCountTable.getView("Counts Next 3 Days");
let counts = await todayCountView.selectRecordsAsync({ fields: ["Page Designation"] });
//console.log(counts);
let mapOfDeadlinesByCueAbbr = createMappingOfUniqueFieldToRecordId(counts.records, 'Page Designation');

//check if entry in table to update
// console.log('Pages:');
// console.log(pages);
// console.log('mapOfDeadlinesByCueAbbr:')
// console.log(mapOfDeadlinesByCueAbbr)
let now = new Date();
//console.log("Now: "+now);

for (let publication in pages) {
    // console.log(publication);
    //split publication into pubdate|publidation
    let split = publication.split('|');
    let pubdate = new Date(split[0]);
    let thisPublication = split[1];
    for (let page in pages[publication]) {
        //split page into section|page
        split = page.split('|');
        let section = split[0];
        let thisPage = split[1];
        let pageDesignation = publication;
        if (thisPage != undefined) {
            pageDesignation += "|"+section+"|"+thisPage;
        } else {
            pageDesignation += "|0|"+section;
            thisPage = section;
            section = '0';
        }
        //console.log('pageDesignation:');
        //console.log(pageDesignation);
        
        let recordMatch = mapOfDeadlinesByCueAbbr[pageDesignation];
        let table = base.getTable("Story Page Counts");
        //console.log("Now: "+now);
        if (recordMatch === undefined) {
            //console.log('record is not created - creating');
            let recordId = await table.createRecordAsync({
                "PubDate": pubdate,
                "Publication": thisPublication,
                "Section": section,
                "Page": thisPage,
                "Count": pages[publication][page],
                "Last Updated Text": now,
            });
            //console.log(recordId);
        } else {
            //console.log('record IS created - updating');
            await table.updateRecordAsync(recordMatch,
                {
                    "PubDate": pubdate,
                    "Publication": thisPublication,
                    "Section": section,
                    "Page": thisPage,
                    "Count": pages[publication][page],
                    "Last Updated Text": now,
                }
            );
        }
    }
}

table = base.getTable("Story Page Counts");
view = table.getView("Counts Next 3 Days - unsorted");
//check the timestamps and clean up anything old
queryResult = await view.selectRecordsAsync({
    fields: ["Last Updated Text"],
    sorts: [
       {field: "Last Updated Text"}
    ]
});

let count = 0;
for (let record of queryResult.records) {
    let thisRecordTime = new Date(`${record.getCellValue("Last Updated Text")}`);
    // console.log('thisRecordTime: '+thisRecordTime);
    // console.log('Now: '+now);
    if (now.getTime() !== thisRecordTime.getTime()) {
        console.log('Record did not update');
        console.log('now');
        console.log(now.getTime());
        console.log(' !== ');
        console.log(record.id);
        console.log(thisRecordTime.getTime());
        try {
            await table.deleteRecordAsync(record.id);
            console.log('Deleted');
        } catch(error) {
            console.error(error);
            console.log(record.id);
        }
        table.deleteRecordAsync(record.id);
        count++;
    }
}
console.log('Deleted: '+count);
