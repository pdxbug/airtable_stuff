//Run Script 2
//Sanitize the code and prepare for the Budget Table
//Created by Kerry Mraz (kerry.mraz@hearst.com)
//Sanitize the code and prepare fields for the Budget Table
//2024.02.05 Refactored from one large autoamation script to multiple Run Script
//           with try/catch, delays, to prevent network timeout

const {
    slugTempTableName,
    thisRecordId,
    maxTries,
    delay,
    errorDetectedConst,
} = input.config();

let errorDetected = errorDetectedConst;
let delayInt = parseInt(delay);

const maxTriesInt = parseInt(maxTries);
const slugTempTable = base.getTable(slugTempTableName);//Dev Table

//trying a new sleep function to put in a slight delay on retry
//just a short delay to try and allow the network to clear
function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
        break;
        }
    }
}

let secondaryPubs;
let primaryCreatedTime = '';
let count = 0;
let thisRecord;
while(true) {
    try {
        thisRecord = await slugTempTable.selectRecordAsync(
            thisRecordId,
            {fields: slugTempTable.fields}
        );
        break;
    } catch (e) {
        // handle exception
        if (count >= maxTriesInt) {
            console.error(`Max retries (${maxTriesInt}) exhausted, final error thrown:`);
            throw e;
        } else {
            var d = new Date();
            var n = d.toLocaleTimeString('en-US', {timeZone: "America/Chicago"});
            console.error(`Error during attempt #${count}:`);
            console.error(n);
            console.error(`Name: `+e.name);
            console.error(`Message: `+e.message);
            errorDetected = thisRecordId;
            sleep(delayInt);
            count++;
        }
    }
}

let fields = {};
var DSOsearch = true;
//go through each column (field), everything will be pushed to the SlugTableName //Budget
for (let field of slugTempTable.fields) {
    //console.log(`Field Name: `+field.name)
    if (
        field.name == "Site Abbrev" ||
        field.name == "Automations complete" ||
        field.name == "Slug" ||
        field.name == "Airtable Record ID" ||
        field.name == "LT Notes" ||
        field.name == "Last Modified By" ||
        field.name == "Last Modified" ||
        field.name == "Last Mod - Automations Checkbox"
    ) {
        //skip due to a field that doesn't exist in Budget table, 
        //or a field that is auto generated in Budget
    } else if (field.name == "Created Time") {
        primaryCreatedTime = thisRecord.getCellValue(field.name);
    } else if (field.name == "Secondary Publication") {
        //get the list of secondary publications to write to
        secondaryPubs = thisRecord.getCellValue(field.name);
        console.log('adding secondary');
        console.log(thisRecord.getCellValue(field.name));
    } else if (field.name == "Other Media") {
        let record = thisRecord.getCellValue(field.name);
        if (record) {
            if (Array.isArray(record)) {
                //multi select
                console.log(field.name+' IS an array');
                record.forEach(function (arrayItem) {
                    delete arrayItem.id;
                    delete arrayItem.color;
                });
                if (field.name.includes('Keywords')) {
                    //we needed a special configuration for Keywords
                    //for now we store them in a list/array;
                    if (keywords.length == 0) {
                        console.log('start keywords with '+record);
                        keywords = record;
                    } else {
                        //we need to go through and remove duplicates?
                        let keywordMatch = false;
                        record.forEach(function (arrayItem) {
                            for (let keyword of keywords) {
                                if (keyword == arrayItem) {
                                    keywordMatch = true;
                                }
                            }
                            if (keywordMatch === false) {
                                // console.log('add '+arrayItem);
                                keywords.push(arrayItem);
                            }
                        });
                    }
                } else {
                    fields[field.name] = record;
                }
            } else {
                //single select
                // Array<{id: string}>,
                console.log(field.name+' is NOT an array');
                // the single select would take the record name but not the id
                delete record.id;
                fields[field.name] = {name: record.name};
            }
        }
    } else if (field.name.indexOf("Digital Sections") != -1) {
        //Digital or Online channel search to add to a single field
        //otherwise it would attempt to add each form field into separate
        //fields in budget and error
        if (DSOsearch) {
            if (thisRecord.getCellValue(field.name)) {
                console.log(field.name+` found! `)
                fields["Channel ID"] = thisRecord.getCellValue(field.name);
                console.log(fields["Channel ID"])
                DSOsearch = false;
            }
        }
    } else {
        if (thisRecord.getCellValue(field.name) != null) {
            //all other fields not caught above can just be pushed into the field
            //this assumes that the field in Dev Table is EXACTLY the same as the 
            //field in Budget table (including emojis!)
            fields[field.name] = thisRecord.getCellValue(field.name);
        } else {
            //skip anything that is null as it will automatically be null or default
            //value in budget table
            //console.log(field.name+" was null, skipping");
        }
    }
}

console.log(fields);
// break out of loop, or return, on success
output.set('thisRecordFields', JSON.stringify(fields));
output.set('secondaryPubs', JSON.stringify(secondaryPubs));
output.set('primaryCreatedTime', primaryCreatedTime);
output.set('errorDetected', errorDetected);