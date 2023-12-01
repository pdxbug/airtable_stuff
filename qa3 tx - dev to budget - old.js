const {
    slugTableName,
    slugTempTableName,
    slugTablePrimaryFieldName,
    debug,
} = input.config();

// helper function
// This creates a map object of primary field and record ID
// example: { FeatureX-AccountY: "recWer23radda" }
const createMappingOfUniqueFieldToRecordId = function (records, fieldName) {
  const mapping = {}
  for (const existingRecord of records) {
    mapping[existingRecord.getCellValueAsString(fieldName)] = existingRecord.id
  }
  return mapping
}

// get the fields we will be pushing to
const slugTable = base.getTable(slugTableName);
const slugTempTable = base.getTable(slugTempTableName);
const newRecords = await slugTempTable.selectRecordsAsync(
    {fields: ["Slug", "Submission Date"],
    sorts: [
       {field: "Submission Date"},
    ]
    });
//console.log(newRecords.records)

// load all existing records in the Slugs table
const existingRecords = await slugTable.selectRecordsAsync({ fields: slugTable.fields });
//console.log(existingRecords)

if (newRecords.records.length == 0) {
    console.log("No new records, abort");
} else {
    let newRecordCount = 0;
    
    //loop through all newRecords
    for (let newRecord of newRecords.records) {
        // create empty arrays
        let counter = "-1";
        let recordsToCreate = [];
        let secondaryPubs;
        let primaryCreatedTime = '';
        let deleteRecord = false;

        // create the mapping using the helper function above
        let mapOfUniqueIdToExistingRecordId = createMappingOfUniqueFieldToRecordId(existingRecords.records, slugTablePrimaryFieldName);
        console.log(mapOfUniqueIdToExistingRecordId)
        console.log(newRecord);
        console.log("Name: "+newRecord.name);        
        let matchString = newRecord.name;
        let recordMatch = mapOfUniqueIdToExistingRecordId[matchString];

        // There is a match, adjust by counter
        if (recordMatch !== undefined) {
            //we have a recordMatch and need to increase the count value and check again
            console.log("Slug already exists: Original Match string: "+matchString);
            for (counter = 1; counter < 10; counter++) {
                let tempMatchString = matchString+'-'+counter;
                recordMatch = mapOfUniqueIdToExistingRecordId[tempMatchString];
                if (recordMatch === undefined) {
                    matchString = tempMatchString;
                    console.log("Break Match string: "+matchString);
                    break;
                }
                console.log("Slug already exists: Match string: "+tempMatchString);
            }
        }

        console.log(`matchString does not exist, let's create it`)
        let fields = {};
        let primaryRecordId = '';
        var DSOsearch = true;

        let queryResult = await slugTempTable.selectRecordsAsync({fields: slugTempTable.fields});
        let records = queryResult.getRecord(newRecord.id);

        for (let field of slugTempTable.fields) {
            //console.log(`Field Name: `+field.name)
            if (field.name == "Submission Date" || field.name == "Site Abbrev" || field.name == "Slug") {
                //skip
            } else if (field.name == "Created Time") {
                primaryCreatedTime = records.getCellValue(field.name);
            } else if (field.name == "Secondary Publication") {
                //get the list of secondary publications to write to
                secondaryPubs = records.getCellValue(field.name);
            } else if (field.name == "Other Media") {
                //requires a different input from text/numbers/etc
                let queryResult = await slugTempTable.selectRecordsAsync(
                    {
                        fields: [field.name, "Submission Date"],
                        sorts: [
                            {field: "Submission Date"},
                        ]
                    }
                );
                let record = records.getCellValue(field.name);
                if (record) {
                    record.forEach(function (arrayItem) {
                        delete arrayItem.id;
                    });
                    fields[field.name] = record;
                }
            } else if (field.name.indexOf("Digital Sections") != -1) {
                if (DSOsearch) {
                    if (records.getCellValue(field.name)) {
                        console.log(field.name+` found! `)
                        fields["Channel ID"] = records.getCellValue(field.name);
                        console.log(fields["Channel ID"])
                        DSOsearch = false;
                    }

                    //we will need to go through all the Digital Sections to find the one that is filled.
                    // let DSO = ["HOU","SAEN","Conroe","MRT","Plainview","Laredo","Beaumont","La Voz"]
                    // for (const option of DSO) {
                    //     if (records.getCellValue("Digital Sections - "+option)) {
                    //         console.log(`Digital Sections - `+option+` found! `)
                    //         fields["Channel ID"] = records.getCellValue("Digital Sections - "+option);
                    //         console.log(fields["Channel ID"])
                    //         DSOsearch = false;
                    //         break;
                    //     }
                    // }
                }
            } else {
                if ((field.name == "Slug" || field.name == "Slug Key") && counter != "-1") {
                    fields[field.name] = records.getCellValue(field.name)+'-'+counter;
                } else {
                    fields[field.name] = records.getCellValue(field.name);
                }
            }
        }
        //Set as Primary
        // fields['Primary/Secondary'] = {name:'Primary'};

        recordsToCreate.push({
            fields
        });
        
        console.log(recordsToCreate);
        for (let recordToCreate of recordsToCreate) {
            //creating the Primary Publication in Budgets
            if (debug == "false") {
                primaryRecordId = await slugTable.createRecordAsync(recordToCreate.fields);
                console.log('primaryRecordId: '+primaryRecordId);
            } else {
                primaryRecordId = 'debug is true';
                console.log("debug set to true, otherwise would have created the new record in "+slugTableName);
            }

            //secondary publications
            if (secondaryPubs) {
                //check for All Texas and recreate secondary Pubs
                for (let secondaryPub of secondaryPubs) {
                    //checking for all texas
                    if (secondaryPub.name == 'All Texas') {
                        let newSecondaryPubs = [];
                        //we need to grab all the publications and set into secondaryPubs
                        const publicationTable = base.getTable('🔒 Publications');
                        const publicationTitles = await publicationTable.selectRecordsAsync({fields: ['Publication Title']});
                        console.log(recordToCreate.fields['Primary Publication'][0])
                        for (publicationTitle of publicationTitles.records) {
                            if (publicationTitle.name != 'Wires' && publicationTitle.name != 'All Texas' && publicationTitle.name != recordToCreate.fields['Primary Publication'][0].name ) {
                                newSecondaryPubs.push(publicationTitle); 
                            }
                        }
                        console.log(newSecondaryPubs);
                        secondaryPubs = newSecondaryPubs;
                        break;
                    }
                }
                // console.log(secondaryPubs);
                //remove the Primary fields from the Secondary Publication
                if (recordToCreate.fields['Channel ID']) {
                    delete recordToCreate.fields['Channel ID']
                }
                if (recordToCreate.fields['Primary Site']) {
                    delete recordToCreate.fields['Primary Site']
                }
                //remove the Primary Publication
                // delete recordToCreate.fields['Primary Publication']
                
                // recordToCreate.fields['Primary/Secondary'] = {name:'Secondary'}
                //creating each of the Secondary Publications in Budgets
                for (let secondaryPub of secondaryPubs) {
                    if (recordToCreate.fields['Primary Publication'][0].name == secondaryPub.name) {
                        console.log("primary pub and secondary pub match, skipping");
                    } else {
                        //create the Secondary Publication
                        console.log(`Creating Secondary Publication in Budget for secondaryPubs.name`)
                        recordToCreate.fields['Secondary Publication'] = [secondaryPub];
                        recordToCreate.fields['Primary Record Lookup'] = [{id:primaryRecordId}];
                        recordToCreate.fields['Primary Record ID'] = primaryRecordId;
                        recordToCreate.fields['Primary Created Time'] = primaryCreatedTime;
                        console.log(recordToCreate.fields)
                        
                        if (debug == "false") {
                            await slugTable.createRecordAsync(recordToCreate.fields);
                        } else {
                            console.log("debug set to true, otherwise would have created the secondary record in "+slugTableName);
                        }
                    }
                }
            }
            console.log(`Created new record in Slugs, removing from Dev table`)
            //remove from the temp table 
            if (debug == "false") {
                deleteRecord = true;
                await slugTempTable.deleteRecordAsync(newRecords.records[newRecordCount]);
            } else {
                console.log("debug set to true, otherwise would have deleted the new record in "+slugTempTableName);
            }
        }
        fields = {};
        newRecordCount = newRecordCount + 1;
    }
}
