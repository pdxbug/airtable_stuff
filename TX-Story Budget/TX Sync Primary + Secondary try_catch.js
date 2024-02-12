//TX Sync Primary + Secondary try/catch
//Sync specific Primary and Secondary Fields
/** Created by Kerry Mraz (kerry.mraz@hearst.com) part of the HNP IT Editorial Team
 * The script is designed to take recently updated records in the 'Budget' Table,
 * check to see if it is a primary or secondary. If primary, specific fields will
 * stamp to the secondary records. If secondary, certain fields must match the primary
 * 
 * Primary records should have a field that contains a list of the secondary records
 * associated to it (a lookup field). We don't actually look at specifically which
 * field was updated, but just stamp all necessary fields to the secondaries regardless
 * 
 * Secondary records will have a Primary Record Lookup field. That way we can pull all the 
 * required fields from the primary and stamp them back on the Secondary
 */


//we are setting up the initial variables and their field types
//the field type has requirements for ingestion into airtable
//and will be used later

/** input constants:
 * thisTable = Budget
 * debug true = this will not make changes but allows the programmer the ability to check what would happen
 *   false = this will make changes in production
 * 
 * */ 

let inputConfig = input.config();
console.log(`${inputConfig.lastModifiedBy}`);
console.log(`${inputConfig.mdwComUpdate}`);

//check to make sure the last update was not an automation, but an actual user trying to make modifications
if (`${inputConfig.lastModifiedBy}` != 'Automations' || 
    (`${inputConfig.lastModifiedBy}` == 'Automations' && `${inputConfig.mdwComUpdate}` == "true") ) {
    let updateFields = {
        thisChannelID: { 
                field:'Channel ID',
                type: 'selectById'
            },
        thisSlugKey: { 
                field:'Slug Key',
                type: 'text'
            },
        thisStoryBudget: { 
                field:'Story Budget',
                type: 'text'
            },
        thisReporter: { 
                field:'Reporters',
                type: 'multiselect'
            },
        thisNotes: { 
                field:'Notes',
                type: 'text'
            },
        thisWordsEst: { 
                field:'Words (est.)',
                type: 'number'
            },
        thisPhotos: { 
                field:'Photos',
                type: 'text'
            },
        thisOtherMedia: { 
                field:'Other Media',
                type: 'mutliselect'
            },
        thisFilingDeadline: { 
                field:'Filing deadline',
                type: 'text'
            },
        thisWebEta: { 
                field:'Web ETA',
                type: 'text'
            },
        thisWcmStatus: { 
                field:'WCM Status',
                type: 'selectByName'
            },
        
        thisInCue: { 
                field:'In Cue?',
                type: 'checkbox'
            },
        thisWordsAct: { 
                field:'Words (actual)',
                type: 'text'
            },
        thisPubSched: { 
                field:'Published/Scheduled Time',
                type: 'text'
            },
        thisLiveUrl: { 
                field:'Live URL',
                type: 'text'
            },
        thisExclude: { 
                field:'Exclude from WCM',
                type: 'checkbox'
            },
    };

    const table = base.getTable(`${inputConfig.thisTable}`);
    console.log(`${inputConfig.thisPrimaryRecordId}`);

    if (`${inputConfig.thisPrimaryRecordId}` == "null") {

        //primary record
        console.log('Primary Record - sync with secondaries');
        //set up fields to update
        let fields = {};
        for (let property in updateFields) {
            if (inputConfig[property]) {
                if (updateFields[property].type == 'selectById') {
                    if (inputConfig[property][0]) {
                        fields[updateFields[property].field] = [{id:inputConfig[property][0]}];
                    } else {
                        fields[updateFields[property].field] = null;
                    }
                } else if (updateFields[property].type == 'selectByName') {
                    fields[updateFields[property].field] = {name:inputConfig[property]};
                } else if (updateFields[property].type == 'multiselect') {
                    let values = [];
                    for (let value of inputConfig[property]) {
                        values.push({id:value});
                    }
                    fields[updateFields[property].field] = values;
                } else if (
                    updateFields[property].type == 'number' || 
                    updateFields[property].type == 'text' || 
                    updateFields[property].type == 'time' || 
                    updateFields[property].type == 'checkbox') {
                    fields[updateFields[property].field] = inputConfig[property];
                } else {
                    fields[updateFields[property].field] = null;
                }
            } else {
                fields[updateFields[property].field] = null;
            }
        }

        //list of the secondary ids should be in Secondary Records
        //if there isn't anything in Secondary Records, we can skip (add this to a view to prevent automation trigger)
        let secondaryIds = `${inputConfig.thisSecondaryRecordIds}`.split(',');
        console.log(secondaryIds);
        for (let secondaryId of secondaryIds) {
            console.log(secondaryId);
            console.log(fields);
            if (`${inputConfig.debug}` == "false") {
//this can be refactored to push one time instead of multiple...
                table.updateRecordAsync(secondaryId, fields);
            } else {
                console.log('debug is set to true, nothing changed');
            }
        }
        let count = 0;
        const maxTries = 3;
        while(true) {
            try {
                table.updateRecordAsync(`${inputConfig.thisAirtableId}`, {'MDW-Com update': false});
                break;
            } catch (e) {
                // handle exception
                if (++count == maxTries) {
                    console.error(`Max retries (${maxTries}) exhausted, final error thrown:`);
                    throw e;
                } else {
                    console.error(`Error during attempt #${count+1}:`);
                    console.error(e);
                }
            }
        }
    } else {
        //secondary record
            //we need to first find the primary pub
            //get all the necessary info
            //and then push back to this secondary
            //we can't allow secondaries to be modified
        
        let theseFields = ["Primary Record ID"];
        for (let value in updateFields) {
            theseFields.push(updateFields[value].field);
        }

        console.log('Secondary Record - sync with primary');
        let primaryRecordId = `${inputConfig.thisPrimaryRecordId}`;
        let primaryRecord = await table.selectRecordAsync(primaryRecordId,
        { 
            fields: theseFields,
        });

        //set up fields to update
        let fields = {};
        for (let property in updateFields) {
            //fields to skip for secondary
            if (updateFields[property].field != '🗑 Spike') {
                console.log(primaryRecord);
                if (primaryRecord == null) {
                    console.log(property+' for updateFields is null please check the Primary/Secondary records exist');
                    throw new Error('Primary Fields are null');
                } else {
                    if (primaryRecord.getCellValue(updateFields[property].field)) {
                        if (updateFields[property].type == 'selectById') {
                            fields[updateFields[property].field] = primaryRecord.getCellValue(updateFields[property].field);
                        } else if (updateFields[property].type == 'selectByName') {
                            fields[updateFields[property].field] = primaryRecord.getCellValue(updateFields[property].field);
                        } else if (updateFields[property].type == 'multiselect') {
                            let values = [];
                            for (let value of primaryRecord.getCellValue(updateFields[property].field)) {
                                values.push(value);
                            }
                            fields[updateFields[property].field] = values;
                        } else if (
                            updateFields[property].type == 'number' || 
                            updateFields[property].type == 'text' || 
                            updateFields[property].type == 'time' || 
                            updateFields[property].type == 'checkbox') {
                            fields[updateFields[property].field] = primaryRecord.getCellValue(updateFields[property].field);
                        } else {
                            fields[updateFields[property].field] = null;
                        }
                    } else {
                        fields[updateFields[property].field] = null;
                    }
                }
            } else {
                console.log('skipping: '+updateFields[property].field);
            }
        }

        console.log("Primary: "+primaryRecordId);
        console.log("Secondary: "+`${inputConfig.thisAirtableId}`);
        console.log(fields);     
        if (`${inputConfig.debug}` == "false") {
            table.updateRecordAsync(`${inputConfig.thisAirtableId}`, fields);
        } else {
            console.log('debug is set to true, nothing changed');
        }
    }
}
