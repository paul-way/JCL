
/*
    jcl.js
    2012-10-22

    JavaScript CRM Library

    Author: Paul Way (www.paul-way.com)    

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.    

	Updates:

	    Date        Description         
	------------ | ----------------------------------------------------------------
	 2012-07-19     Added the ability to update and publish a web resource.  Added
	                the Base64 Encoding (required bitwise on JSLint).

	 2012-10-22     Added cross browser support for the FetchXML parsing (as well as IE 10)

*/

/*jslint browser: true, nomen: true, newcap: true, sloppy:true, plusplus:true, bitwise: true */
/*global ActiveXObject, alert, CrmEncodeDecode, DOMParser, GetGlobalContext, ORG_UNIQUE_NAME, Xrm */

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
			entOSV, entRef, entCV, parser, recordCount, xmlLabel, xmlValue;

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

		if (window.DOMParser) {
			// IE 9/10, Chrome, Firefox & Safari
			parser = new DOMParser();
			resultDoc = parser.parseFromString(xmlhttp.responseText, "text/xml");
			resultDoc = resultDoc.getElementsByTagName("a:Entities")[0];

			xmlLabel = "localName";
			xmlValue = "textContent";
		} else {
			// IE 8 and below
		    sFetchResult = xmlhttp.responseXML.selectSingleNode("//a:Entities").xml;

		    resultDoc = new ActiveXObject("Microsoft.XMLDOM");
		    resultDoc.async = false;
		    resultDoc.loadXML(sFetchResult);
		    resultDoc = resultDoc.firstChild;

		    xmlLabel = "baseName";
		    xmlValue = "text";
		}

	    //parse result xml into array of jsDynamicEntity objects
	    recordCount = resultDoc.childNodes.length;
	    results = []; //new Array(recordCount);

	    for (i = 0; i < recordCount; i++) {
	        oResultNode = resultDoc.childNodes[i];
	        jDE = new JCL._DynamicEntity();
	        obj = {};

	        for (j = 0; j < oResultNode.childNodes.length; j++) {
	            switch (oResultNode.childNodes[j][xmlLabel]) {
	            case "Attributes":
	                attr = oResultNode.childNodes[j];

	                for (k = 0; k < attr.childNodes.length; k++) {

	                    // Establish the Key for the Attribute 
	                    sKey = attr.childNodes[k].firstChild[xmlValue];
	                    sType = '';

	                    // Determine the Type of Attribute value we should expect 
	                    for (l = 0; l < attr.childNodes[k].childNodes[1].attributes.length; l++) {
	                        if (attr.childNodes[k].childNodes[1].attributes[l][xmlLabel] === 'type') {
	                            sType = attr.childNodes[k].childNodes[1].attributes[l][xmlValue];
	                        }
	                    }

	                    switch (sType) {
	                    case "a:OptionSetValue":
	                        entOSV = new JCL._OptionSetValue();
	                        entOSV.type = sType;
	                        entOSV.value = attr.childNodes[k].childNodes[1][xmlValue];
	                        obj[sKey] = entOSV;
	                        break;

	                    case "a:EntityReference":
	                        entRef = new JCL._EntityReference();
	                        entRef.type = sType;
	                        entRef.guid = attr.childNodes[k].childNodes[1].childNodes[0][xmlValue];
	                        entRef.logicalName = attr.childNodes[k].childNodes[1].childNodes[1][xmlValue];
	                        entRef.name = attr.childNodes[k].childNodes[1].childNodes[2][xmlValue];
	                        obj[sKey] = entRef;
	                        break;

	                    default:
	                        entCV = new JCL._CrmValue();
	                        entCV.type = sType;
	                        entCV.value = attr.childNodes[k].childNodes[1][xmlValue];
	                        obj[sKey] = entCV;

	                        break;
	                    }

	                }

	                jDE.attributes = obj;
	                break;

	            case "Id":
	                jDE.guid = oResultNode.childNodes[j][xmlValue];
	                break;

	            case "LogicalName":
	                jDE.logicalName = oResultNode.childNodes[j][xmlValue];
	                break;

	            case "FormattedValues":
	                foVal = oResultNode.childNodes[j];

	                for (k = 0; k < foVal.childNodes.length; k++) {
	                    // Establish the Key, we are going to fill in the formatted value of the already found attribute 
	                    sKey = foVal.childNodes[k].firstChild[xmlValue];

	                    jDE.attributes[sKey].formattedValue = foVal.childNodes[k].childNodes[1][xmlValue];
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

	JCL._GenericCallback = function (xmlhttp, callback) {
		'use strict';

		///<summary>(private) Fetch message callback.</summary>
		//xmlhttp must be completed
		if (xmlhttp.readyState !== JCL.XMLHTTPREADY) {
			return;
		}

		//check for server errors
		if (JCL._HandleErrors(xmlhttp)) {
			return;
		}

		//return entities
		if (callback !== null) {
			callback(true); //results);
		} else {
			return true;
		}

	};

	JCL._ExecuteRequest = function (sXml, sMessage, fInternalCallback, fUserCallback) {
		'use strict';

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open("POST", JCL.server + "/XRMServices/2011/Organization.svc/web", (fUserCallback !== null));
		xmlhttp.setRequestHeader("Accept", "application/xml, text/xml, */*");
		xmlhttp.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		xmlhttp.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/" + sMessage);

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

		/// Executes a FetchXml request.  (Returns an array of entity records)

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

		return JCL._ExecuteRequest(request, "Execute", JCL._FetchCallback, fCallback);
	};

	JCL.fetch = function (FetchXML, cb) {
		JCL.Fetch(FetchXML, cb);
	};

	JCL.RetrieveAllEntitiesRequest = function (fnCallBack) {

		/// Returns a sorted array of entities

		var request = "";
		request += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		request += "  <s:Body>";
		request += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
		request += "      <request i:type=\"a:RetrieveAllEntitiesRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\">";
		request += "        <a:Parameters xmlns:b=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <b:key>EntityFilters</b:key>";
		request += "            <b:value i:type=\"c:EntityFilters\" xmlns:c=\"http://schemas.microsoft.com/xrm/2011/Metadata\">Entity</b:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <b:key>RetrieveAsIfPublished</b:key>";
		request += "            <b:value i:type=\"c:boolean\" xmlns:c=\"http://www.w3.org/2001/XMLSchema\">true</b:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "        </a:Parameters>";
		request += "        <a:RequestId i:nil=\"true\" />";
		request += "        <a:RequestName>RetrieveAllEntities</a:RequestName>";
		request += "      </request>";
		request += "    </Execute>";
		request += "  </s:Body>";
		request += "</s:Envelope>";

		return JCL._ExecuteRequest(request, "Execute", JCL._RetrieveAllEntitiesResponse, fnCallBack);
	};

	JCL._RetrieveAllEntitiesResponse = function (xmlhttp, callback) {

		if (xmlhttp.readyState !== JCL.XMLHTTPREADY) {
			return;
		}

		//check for server errors
		if (JCL._HandleErrors(xmlhttp)) {
			return;
		}

		var myList = [],
			resultDoc = new ActiveXObject("Microsoft.XMLDOM"),
			entList = resultDoc.getElementsByTagName("c:EntityMetadata"),
			i = 0,
			j = 0,
			k = 0,
			entRef,
			attrCount,
			sBase;

		resultDoc.async = false;
		resultDoc.loadXML(xmlhttp.responseXML.xml);

		for (i = 0; i < entList.length; i++) {
			entRef = new JCL._EntityReference();
			attrCount = entList[i].childNodes.length;

			for (j = 0; j < attrCount; j++) {
				sBase = entList[i].childNodes[j].baseName;

				if (sBase === "MetadataId") {
					entRef.guid = entList[i].childNodes[j].text;
				}

				if (sBase === "LogicalName") {
					entRef.logicalName = entList[i].childNodes[j].text;
				}

				if (sBase === "ObjectTypeCode") {
					entRef.objectTypeCode = entList[i].childNodes[j].text;
				}

				if (sBase === "DisplayCollectionName") {
					try {
						if (entList[i].childNodes[j].text !== "") {
							entRef.PluralName = entList[i].childNodes[j].childNodes[1].childNodes[1].text;
						}
					} catch (e1) {
						entRef.PluralName = "";
					}
				}

				if (sBase === "DisplayName") {
					try {
						if (entList[i].childNodes[j].text !== "") {
							entRef.DisplayName = entList[i].childNodes[j].childNodes[1].childNodes[1].text;
						}
					} catch (e2) {
						entRef.DisplayName = "";
					}
				}
		    }

			if (typeof entRef.DisplayName !== "undefined") {
				myList[k++] = entRef;
			}

		}
		//alert(myList.length);
		myList.sort(JCL._SortEntityRef);

		//return entities
		if (callback !== null) {
			callback(myList);
		} else {
			return myList;
		}

	};

	JCL.UpdateWebResource = function (sGuid, sData, fCallback) {
		'use strict';

		var request = "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		request += "<s:Body>";
		request += '<Update xmlns="http://schemas.microsoft.com/xrm/2011/Contracts/Services">' +
			'<entity xmlns:b="http://schemas.microsoft.com/xrm/2011/Contracts" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">' +
			'<b:Attributes xmlns:c="http://schemas.datacontract.org/2004/07/System.Collections.Generic">' +
			'<b:KeyValuePairOfstringanyType>' +
			'<c:key>content</c:key>' +
			'<c:value i:type="d:string" xmlns:d="http://www.w3.org/2001/XMLSchema">' +
			'Ly8gdGVzdCBzYXZl' +  // Base 64 Data
			'</c:value>' +
			'</b:KeyValuePairOfstringanyType>' +
			'</b:Attributes>' +
			'<b:EntityState i:nil="true"/>' +
			'<b:Id>' + sGuid + '</b:Id>' +
			'<b:LogicalName>webresource</b:LogicalName>' +
			'<b:RelatedEntities xmlns:c="http://schemas.datacontract.org/2004/07/System.Collections.Generic"/>' +
			'</entity>' +
			'</Update>';

		request += '</s:Body></s:Envelope>';

		return JCL._ExecuteRequest(request, "Update", JCL._GenericCallback, fCallback);
	};

	JCL.PublishWebResource = function (sGuid, fCallback) {
		'use strict';

		var request = "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		request += "<s:Body>";
		request += '<Execute xmlns="http://schemas.microsoft.com/xrm/2011/Contracts/Services">' +
			'<request i:type="c:PublishXmlRequest" ' +
			'xmlns:b="http://schemas.microsoft.com/xrm/2011/Contracts" xmlns:c="http://schemas.microsoft.com/crm/2011/Contracts" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">' +
			'<b:Parameters xmlns:d="http://schemas.datacontract.org/2004/07/System.Collections.Generic">' +
			'<b:KeyValuePairOfstringanyType>' +
			'<d:key>ParameterXml</d:key>' +
			'<d:value i:type="e:string" xmlns:e="http://www.w3.org/2001/XMLSchema">' +
			'&lt;importexportxml&gt;&lt;webresources&gt;&lt;webresource&gt;' + sGuid + '&lt;/webresource&gt;&lt;/webresources&gt;&lt;/importexportxml&gt;' +
			'</d:value>' +
			'</b:KeyValuePairOfstringanyType>' +
			'</b:Parameters>' +
			'<b:RequestId i:nil="true"/>' +
			'<b:RequestName>PublishXml</b:RequestName>' +
			'</request>' +
			'</Execute>';

		request += '</s:Body></s:Envelope>';

		return JCL._ExecuteRequest(request, "Execute", JCL._GenericCallback, fCallback);
	};

	JCL.RemoveParams = function (guid) {
		guid = guid.replace('%7b', '').replace('%7d', '');
		return guid;
	};

	JCL.GetUrlParameter = function (name) {
		name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");

		var regexS = "[\\?&]" + name + "=([^&#]*)",
			regex = new RegExp(regexS),
			results = regex.exec(window.location.href);

		if (results === null) {
			return "";
		} else {
			return results[1];
		}
	};

	JCL._Base64Encode = function (data) {

		// http://kevin.vanzonneveld.net
		// +   original by: Tyler Akins (http://rumkin.com)
		// +   improved by: Bayron Guevara
		// +   improved by: Thunder.m
		// +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// +   bugfixed by: Pellentesque Malesuada
		// +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// +   improved by: Rafał Kukawski (http://kukawski.pl)
		// +   improved by: Paul Way (www.paul-way.com)
		// *     example 1: base64_encode('Kevin van Zonneveld');
		// *     returns 1: 'S2V2aW4gdmFuIFpvbm5ldmVsZA=='

		var o1, o2, o3, h1, h2, h3, h4, r, bits, i = 0,
		    ac = 0,
		    enc = "",
		    tmp_arr = [],
		    b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

		if (!data) {
		    return data;
		}

		do { // pack three octets into four hexets
		    o1 = data.charCodeAt(i++);
		    o2 = data.charCodeAt(i++);
		    o3 = data.charCodeAt(i++);

		    bits = o1 << 16 | o2 << 8 | o3;

		    h1 = bits >> 18 & 0x3f;
		    h2 = bits >> 12 & 0x3f;
		    h3 = bits >> 6 & 0x3f;
		    h4 = bits & 0x3f;

		    // use hexets to index into b64, and append result to encoded string
		    tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
		} while (i < data.length);

		enc = tmp_arr.join('');

		r = data.length % 3;

		return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
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

	JCL._SortEntityRef = function (a, b) {
		if (a.DisplayName === b.DisplayName) {
			return 0;
		} else if (a.DisplayName > b.DisplayName) {
			return 1;
		} else {
			return -1;
		}
	};

}());
