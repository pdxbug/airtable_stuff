//Run Script 4
//Create the Primary Record
/** Created by Kerry Mraz (kerry.mraz@hearst.com) part of the HNP IT Editorial Team
 * The script is designed to take new records created in the form and included in the 'Dev Table'
 * process for duplicates, combine Digital/Online Channels, create Secondary Publication
 *
 *
 */

/**set the constant variables
* this create the budgetTableName 'Budget', slugTempTableName 'Dev Table', slugTablePrimaryFieldName 'Slug',
* it pulls in the record ID and record Name that was just created for quick comparison of values
* sets the debug value false means it will run the slugs into the Budget Table and true means it will only debug
* preventing any records from being created in the Budget Table (very useful for code debugging without creating 
* records that need to be removed later)
*
*/
const {
    budgetTableName,
    recordToCreateJSON,
    maxTries,
    delay,
    debug,
    errorDetectedConst,
    thisAirtableId
} = input.config();
let errorDetected = errorDetectedConst;

const maxTriesInt = parseInt(maxTries);
const delayInt = parseInt(delay);
//try/catch maximum number of retries
let tryCatchCount = 0;
// get the table, view and fields we will be pushing to
const slugTable = base.getTable(budgetTableName);//Budget

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

let recordToCreate = JSON.parse(recordToCreateJSON);
console.log(recordToCreate);
let primaryRecordId;
while(true) {
    try {
        //creating the Primary Publication in Budgets
        if (debug == "false") {
            primaryRecordId = await slugTable.createRecordAsync(recordToCreate);
            console.log('primaryRecordId: '+primaryRecordId);
        } else {
            primaryRecordId = 'reczyr10nKIamhaCO';
            console.log("debug set to true, otherwise would have created the new record in "+budgetTableName);
        }
        output.set('primaryRecordId', primaryRecordId);
        output.set('errorDetected', errorDetected);
        break;
    } catch (e) {
        // handle exception
        if (tryCatchCount >= maxTriesInt) {
            console.error(`Max retries (${maxTriesInt}) exhausted, final error thrown:`);
            throw e;
        } else {
            var d = new Date();
            var n = d.toLocaleTimeString('en-US', {timeZone: "America/Chicago"});
            console.error(`Error during attempt #${tryCatchCount}:`);
            console.log(n);
            console.error(`Name: `+e.name);
            console.error(`Message: `+e.message);
            errorDetected = thisAirtableId;
            sleep(delayInt);
            tryCatchCount++;
        }
    }
}
