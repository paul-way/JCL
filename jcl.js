
/*
    jcl.js
    2012-6-27

    JavaScript CRM Library

*/

/*jslint browser: true, nomen: true, newcap: true, sloppy:true, plusplus:true */
/*global ORG_UNIQUE_NAME */
/*global CrmEncodeDecode */
/*global alert */
/*global GetGlobalContext */
/*global Xrm */
/*global ActiveXObject */

var JCL;
if (!JCL) {
	JCL = {};
}

(function () {

	JCL.XMLHTTPSUCCESS = 200;
	JCL.XMLHTTPREADY = 4;

	// Set the context
	if (typeof GetGlobalContext !== "undefined") {
		JCL._context = GetGlobalContext();
	} else {
		if (typeof Xrm !== "undefined") {
			JCL._context = Xrm.Page.context;
		} else {
			JCL._context = undefined;
			//throw new Error("Context is not available.");
		}
	}

	if (typeof JCL._context !== 'undefined') {
		JCL.org = JCL._context.getOrgUniqueName();
		//JCL.server = JCL._context.getServerUrl();

		JCL.server = JCL._context.getServerUrl();
		if (JCL.server.match(/\/$/)) {
			JCL.server = JCL.server.substring(0, JCL.server.length - 1);
		}
	}

	JCL._FetchCallback = function (xmlhttp, callback) {
		'use strict';

		var xmlReturn, results, sFetchResult, resultDoc, i, j, k, l,
			oResultNode, jDE, obj, attr, sKey, sType, foVal,
			entOSV, entRef, entCV;

		///<summary>(private) Fetch message callback.</summary>
		//xmlhttp must be completed
		if (xmlhttp.readyState !== JCL.XMLHTTPREADY) {
			return;
		}

		//check for server errors
		if (JCL._HandleErrors(xmlhttp)) {
			return;
		}

		// xmlReturn = xmlhttp.responseXML.xml;
		// xmlReturn = xmlReturn.replace(/</g, '&lt;');
		// xmlReturn = xmlReturn.replace(/>/g, '&gt;');

		// results = xmlReturn;

	    sFetchResult = xmlhttp.responseXML.selectSingleNode("//a:Entities").xml;

	    resultDoc = new ActiveXObject("Microsoft.XMLDOM");
	    resultDoc.async = false;
	    resultDoc.loadXML(sFetchResult);

	    //parse result xml into array of jsDynamicEntity objects
	    results = new Array(resultDoc.firstChild.childNodes.length);
	    for (i = 0; i < resultDoc.firstChild.childNodes.length; i++) {
	        oResultNode = resultDoc.firstChild.childNodes[i];
	        jDE = new JCL._DynamicEntity();
	        obj = {};

	        for (j = 0; j < oResultNode.childNodes.length; j++) {
	            switch (oResultNode.childNodes[j].baseName) {
	            case "Attributes":
	                attr = oResultNode.childNodes[j];

	                for (k = 0; k < attr.childNodes.length; k++) {

	                    // Establish the Key for the Attribute 
	                    sKey = attr.childNodes[k].firstChild.text;
	                    sType = '';

	                    // Determine the Type of Attribute value we should expect 
	                    for (l = 0; l < attr.childNodes[k].childNodes[1].attributes.length; l++) {
	                        if (attr.childNodes[k].childNodes[1].attributes[l].baseName === 'type') {
	                            sType = attr.childNodes[k].childNodes[1].attributes[l].text;
	                        }
	                    }

	                    switch (sType) {
	                    case "a:OptionSetValue":
	                        entOSV = new JCL._OptionSetValue();
	                        entOSV.type = sType;
	                        entOSV.value = attr.childNodes[k].childNodes[1].text;
	                        obj[sKey] = entOSV;
	                        break;

	                    case "a:EntityReference":
	                        entRef = new JCL._EntityReference();
	                        entRef.type = sType;
	                        entRef.guid = attr.childNodes[k].childNodes[1].childNodes[0].text;
	                        entRef.logicalName = attr.childNodes[k].childNodes[1].childNodes[1].text;
	                        entRef.name = attr.childNodes[k].childNodes[1].childNodes[2].text;
	                        obj[sKey] = entRef;
	                        break;

	                    default:
	                        entCV = new JCL._CrmValue();
	                        entCV.type = sType;
	                        entCV.value = attr.childNodes[k].childNodes[1].text;
	                        obj[sKey] = entCV;

	                        break;
	                    }

	                }

	                jDE.attributes = obj;
	                break;

	            case "Id":
	                jDE.guid = oResultNode.childNodes[j].text;
	                break;

	            case "LogicalName":
	                jDE.logicalName = oResultNode.childNodes[j].text;
	                break;

	            case "FormattedValues":
	                foVal = oResultNode.childNodes[j];

	                for (k = 0; k < foVal.childNodes.length; k++) {
	                    // Establish the Key, we are going to fill in the formatted value of the already found attribute 
	                    sKey = foVal.childNodes[k].firstChild.text;

	                    jDE.attributes[sKey].formattedValue = foVal.childNodes[k].childNodes[1].text;


	                }
	                break;
	            }

	        }

	        results[i] = jDE;
	    }


		//return entities
		if (callback !== null) {
			callback(results);
		} else {
			return results;
		}




	};


	JCL._HandleErrors = function (xmlhttp) {
		'use strict';

		/// <summary>(private) Handles xmlhttp errors</summary>
		if (xmlhttp.status !== JCL.XMLHTTPSUCCESS) {
			var sError = "Error: " + xmlhttp.responseText + " " + xmlhttp.statusText;
			alert(sError);
			return true;
		} else {
			return false;
		}
	};


	JCL._ExecuteRequest = function (sXml, sMessage, fInternalCallback, fUserCallback) {
		'use strict';

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open("POST", JCL.server + "/XRMServices/2011/Organization.svc/web", (fUserCallback !== null));
		xmlhttp.setRequestHeader("Accept", "application/xml, text/xml, */*");
		xmlhttp.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		xmlhttp.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");

		if (fUserCallback !== null) {
			//asynchronous: register callback function, then send the request.
			//var crmServiceObject = this;
			xmlhttp.onreadystatechange = function () {
				fInternalCallback.call(this, xmlhttp, fUserCallback);
			};

			xmlhttp.send(sXml);
		} else {
			//synchronous: send request, then call the callback function directly
			xmlhttp.send(sXml);
			return fInternalCallback.call(this, xmlhttp, null);
		}
	};


	JCL.Fetch = function (sFetchXml, fCallback) {
		'use strict';

		/// <summary>Execute a FetchXml request. (result is the response XML)</summary>
		/// <param name="sFetchXml">fetchxml string</param>
		/// <param name="fCallback" optional="true" type="function">(Optional) Async callback function if specified. If left null, function is synchronous </param>

		var request = "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		request += "<s:Body>";
		request += '<Execute xmlns="http://schemas.microsoft.com/xrm/2011/Contracts/Services">' +
			'<request i:type="b:RetrieveMultipleRequest" ' +
			' xmlns:b="http://schemas.microsoft.com/xrm/2011/Contracts" ' +
			' xmlns:i="http://www.w3.org/2001/XMLSchema-instance">' +
			'<b:Parameters xmlns:c="http://schemas.datacontract.org/2004/07/System.Collections.Generic">' +
			'<b:KeyValuePairOfstringanyType>' +
			'<c:key>Query</c:key>' +
			'<c:value i:type="b:FetchExpression">' +
			'<b:Query>';

		request += CrmEncodeDecode.CrmXmlEncode(sFetchXml);

		request += '</b:Query>' +
			'</c:value>' +
			'</b:KeyValuePairOfstringanyType>' +
			'</b:Parameters>' +
			'<b:RequestId i:nil="true"/>' +
			'<b:RequestName>RetrieveMultiple</b:RequestName>' +
			'</request>' +
			'</Execute>';

		request += '</s:Body></s:Envelope>';

		return JCL._ExecuteRequest(request, "Fetch", JCL._FetchCallback, fCallback);
	};


	JCL._DynamicEntity = function (gID, sLogicalName) {
	    this.guid = gID;
	    this.logicalName = sLogicalName;
	    this.attributes = {};
	};

	JCL._CrmValue = function (sType, sValue) {
	    this.type = sType;
	    this.value = sValue;
	};

	JCL._EntityReference = function (gID, sLogicalName, sName) {
	    this.guid = gID;
	    this.logicalName = sLogicalName;
	    this.name = sName;
	    this.type = 'EntityReference';
	};

	JCL._OptionSetValue = function (iValue, sFormattedValue) {
	    this.value = iValue;
	    this.formattedValue = sFormattedValue;
	    this.type = 'OptionSetValue';
	};


}());


