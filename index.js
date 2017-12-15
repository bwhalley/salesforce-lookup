const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('superagent');
const sf_token = process.env.SF_TOKEN

const CONVERSATION_API_BASE = process.env.QA ? 'https://driftapi.com/conversations' : 'https://driftapi.com/conversations'
const CONTACT_API_BASE = process.env.QA ? 'https://driftapi.com/contacts' : 'https://driftapi.com/contacts'

const TOKEN = process.env.BOT_API_TOKEN



function handleMessage(orgId, data) {
  if (data.type === 'private_note') {
    console.log('found a private note!')
    const messageBody = data.body
    const conversationId = data.conversationId
    console.log('converation id = ' + conversationId)
    console.log('org id = ' + orgId)

    if (messageBody.startsWith('/lookup')) {
        console.log('found a lookup action!')
      return returnMessage(conversationId, contactCallback, orgId)
    }
  }
}


// request function
function returnMessage(conversationId, callbackFn, orgId) {

      
  request
   .get(CONVERSATION_API_BASE + `${conversationId}`)
    .set('Content-Type', 'application/json')
    .set(`Authorization`, `bearer ${TOKEN}`)
   .end(function(err, res){
       callbackFn(res.body.data.contactId, conversationId, orgId)
     });
}

// call back function
function contactCallback(contactId, conversationId, orgId) { 
    return getContactEmail(contactId, emailCallback, conversationId, orgId);
}

function getContactEmail (contactId, callbackFn, conversationId, orgId) {

request
  .get(CONTACT_API_BASE + `${contactId}`)
  .set(`Authorization`, `bearer ${TOKEN}`)
  .set('Content-Type', 'application/json')
  .end(function (err, res) {
        callbackFn(res.body.data.attributes.email, conversationId, orgId)
     });
}

// call back function
function emailCallback(emailAddress, conversationId, orgId) { 
    return callSF(emailAddress, sfCallback, conversationId, orgId)
}

function callSF(emailAddress, callbackFn, conversationId, orgId) {

	var jsforce = require('jsforce');
	var conn = new jsforce.Connection({
	  instanceUrl : 'https://na52.salesforce.com',
	  accessToken : sf_token
	});

	var records = [];
	conn.query("SELECT Id, Email, FirstName, LastName, Last_RM_Studio_usage__c FROM Lead where Email = '"+emailAddress+"'", function(err, result) {
	  if (err) { return console.error(err); }

	  var firstName = result.records[0].FirstName;
	  var lastName = result.records[0].LastName;
	  var Id = result.records[0].Id;
	  var lastStudioUsage = result.records[0].Last_RM_Studio_usage__c
	  
	  body = "Salesforce Link: <a target="_blank" href=https://na52.salesforce.com/" + Id + ">" + firstName + " " + lastName + "</a><br/>Last RM Studio Usage: " + lastStudioUsage
	  	    
	  callbackFn(body, conversationId, orgId)
	  
	});

}

// call back function
function sfCallback(body, conversationId, orgId) { 

    const message = {
    'orgId': orgId,
    'body': body,
    'type': false ? 'edit' : 'private_prompt',
  }
  
    return request.post(CONVERSATION_API_BASE + `/${conversationId}/messages`)
    .set('Content-Type', 'application/json')
    .set(`Authorization`, `bearer ${TOKEN}`)
    .send(message)
    .catch(err => console.log(err))
    
}


app.use(bodyParser.json())
app.listen(process.env.PORT || 3000, () => console.log('Example app listening on port 3000!'))
app.post('/api', (req, res) => {
  if (req.body.type === 'new_message') {
    
    handleMessage(req.body.orgId, req.body.data);  
    
  }
  return res.send('ok')
})
