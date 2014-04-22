/*
jcl.js
2012-10-22

JavaScript CRM Library

Author: Paul Way [www.CustomerEffective.com (work) | www.paul-way.com (play) | @paul_way (twitter)]

NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

Updates:

Date        Description
------------ | ------------------------------------------------------------------
2014-01-28     Added error callbacks to fetch, web resource, and entity methods.

2014-01-22     Added Assign method.

2012-10-22     Added cross browser support for the FetchXML parsing (as well as
IE 10)

2012-07-19     Added the ability to update and publish a web resource.  Added
the Base64 Encoding (required bitwise on JSLint).

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

		if (typeof JCL._context.getClientUrl === 'function') {
			JCL.server = JCL._context.getClientUrl();
		} else {
			JCL.server = JCL._context.getServerUrl();
		}

		if (JCL.server.match(/\/$/)) {
			JCL.server = JCL.server.substring(0, JCL.server.length - 1);
		}
	}

	JCL._FetchCallback = function (xmlhttp, successCallback, errorCallback) {
		'use strict';

		var xmlReturn,
			results,
			sFetchResult,
			resultDoc,
			i,
			j,
			k,
			l,
			oResultNode,
			jDE,
			obj,
			attr,
			sKey,
			sType,
			foVal,
			entOSV,
			entRef,
			entCV,
			parser,
			recordCount,
			xmlLabel,
			xmlValue,
			pagingCookie = {};

		//xmlhttp must be completed
		if (xmlhttp.readyState !== JCL.XMLHTTPREADY) {
			return;
		}

		//check for server errors
		if (JCL._HandleErrors(xmlhttp, errorCallback)) {
			return;
		}

		pagingCookie = {};

		if (window.DOMParser) {
			// IE 9/10, Chrome, Firefox & Safari
			parser = new DOMParser();
			resultDoc = parser.parseFromString(xmlhttp.responseText, "text/xml");

			if (resultDoc.getElementsByTagName("a:Entities").length > 0) {
				// IE 9/10
				pagingCookie.raw = resultDoc.getElementsByTagName("a:PagingCookie")[0].textContent;
				resultDoc = resultDoc.getElementsByTagName("a:Entities")[0];
			} else {
				// Webkit
				pagingCookie.raw = resultDoc.getElementsByTagName("PagingCookie")[0].textContent;
				resultDoc = resultDoc.getElementsByTagName("Entities")[0];
			}

			xmlLabel = "localName";
			xmlValue = "textContent";
		} else {
			// IE 8 and below
			sFetchResult = xmlhttp.responseXML.selectSingleNode("//a:Entities").xml;

			resultDoc = new ActiveXObject("Microsoft.XMLDOM");
			resultDoc.async = false;
			resultDoc.loadXML(sFetchResult);
			resultDoc = resultDoc.firstChild;

			pagingCookie.raw = xmlhttp.responseXML.selectSingleNode("//a:PagingCookie").xml;

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

						case "a:AliasedValue":
							entCV = new JCL._CrmValue();
							if (attr.childNodes[k].childNodes[1].childNodes[2].childNodes.length > 1) {
								entCV.type = "a:EntityReference";
								entCV.guid = attr.childNodes[k].childNodes[1].childNodes[2].childNodes[0][xmlValue];
								entCV.logicalName = attr.childNodes[k].childNodes[1].childNodes[2].childNodes[1][xmlValue];
								entCV.name = attr.childNodes[k].childNodes[1].childNodes[2].childNodes[2][xmlValue];
							} else {
								entCV.type = sType;
								entCV.value = attr.childNodes[k].childNodes[1].childNodes[2][xmlValue];
							}

							obj[sKey] = entCV;
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

		results.pagingCookie = pagingCookie;
		//pagingCookie.page =

		//return entities
		if (successCallback !== null) {
			successCallback(results);
		} else {
			return results;
		}

	};

	JCL._HandleErrors = function (xmlhttp, callback) {
		'use strict';

		/// <summary>(private) Handles xmlhttp errors</summary>
		if (xmlhttp.status !== JCL.XMLHTTPSUCCESS) {
			var sError = "Error: " + xmlhttp.responseText + " " + xmlhttp.statusText;
			if (callback !== null) {
				callback(sError);
			}
			return true;
		} else {
			return false;
		}
	};

	JCL._GenericCallback = function (xmlhttp, successCallback, errorCallback) {
		'use strict';

		///<summary>(private) Fetch message callback.</summary>
		//xmlhttp must be completed
		if (xmlhttp.readyState !== JCL.XMLHTTPREADY) {
			return;
		}

		//check for server errors
		if (JCL._HandleErrors(xmlhttp, errorCallback)) {
			return;
		}

		//return entities
		if (successCallback !== null) {
			successCallback(true);
		} else {
			return true;
		}

	};

	JCL.oDataPath = function () {
		///<summary>
		/// Private function to return the path to the REST endpoint.
		///</summary>
		///<returns>String</returns>
		return JCL.server + "/XRMServices/2011/OrganizationData.svc/";
	};

	JCL._ExecuteRequest = function (sXml, sMessage, fInternalCallback, fSuccessCallback, fErrorCallback) {
		'use strict';

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open("POST", JCL.server + "/XRMServices/2011/Organization.svc/web", (fSuccessCallback !== null || fErrorCallback !== null));
		xmlhttp.setRequestHeader("Accept", "application/xml, text/xml, */*");
		xmlhttp.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		xmlhttp.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/" + sMessage);

		if (fSuccessCallback !== null || fErrorCallback !== null) {
			// asynchronous: register callback function, then send the request.
			xmlhttp.onreadystatechange = function () {
				fInternalCallback.call(this, xmlhttp, fSuccessCallback, fErrorCallback);
			};

			xmlhttp.send(sXml);
		} else {
			// synchronous: send request, then call the callback function directly
			xmlhttp.send(sXml);
			return fInternalCallback.call(this, xmlhttp, null, null);
		}
	};

	JCL.Fetch = function (sFetchXml, fSuccessCallback, fErrorCallback) {
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

		// To execute synchronously, the calling function should pass null.
		//   This allows the user to pass nothing for a callback to execute synchronously
		if (typeof fSuccessCallback === 'undefined') {
			fSuccessCallback = null;
		}
		if (typeof fErrorCallback === 'undefined') {
			fErrorCallback = null;
		}

		return JCL._ExecuteRequest(request, "Execute", JCL._FetchCallback, fSuccessCallback, fErrorCallback);
	};

	JCL.fetch = function (FetchXML, successCallback, errorCallback) {
		JCL.Fetch(FetchXML, successCallback, errorCallback);
	};

	JCL.RetrieveEntityRequest = function (logicalName, fnSuccessCallback, fnErrorCallback) {
		/// Returns a sorted array of entities
		var request = "";
		request += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		request += "  <s:Body>";
		request += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
		request += "      <request i:type=\"a:RetrieveEntityRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\">";
		request += "        <a:Parameters xmlns:b=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <b:key>EntityFilters</b:key>";
		request += "            <b:value i:type=\"c:EntityFilters\" xmlns:c=\"http://schemas.microsoft.com/xrm/2011/Metadata\">Entity Attributes Privileges Relationships</b:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <b:key>MetadataId</b:key>";
		request += "            <b:value i:type=\"ser:guid\"  xmlns:ser=\"http://schemas.microsoft.com/2003/10/Serialization/\">00000000-0000-0000-0000-000000000000</b:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "             <b:key>LogicalName</b:key>";
		request += "             <b:value i:type=\"c:string\" xmlns:c=\"http://www.w3.org/2001/XMLSchema\">" + logicalName + "</b:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <b:key>RetrieveAsIfPublished</b:key>";
		request += "            <b:value i:type=\"c:boolean\" xmlns:c=\"http://www.w3.org/2001/XMLSchema\">true</b:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "        </a:Parameters>";
		request += "        <a:RequestId i:nil=\"true\" />";
		request += "        <a:RequestName>RetrieveEntity</a:RequestName>";
		request += "      </request>";
		request += "    </Execute>";
		request += "  </s:Body>";
		request += "</s:Envelope>";

		return JCL._ExecuteRequest(request, "Execute", JCL._RetrieveEntityResponse, fnSuccessCallback, fnErrorCallback);
	};

	JCL._RetrieveEntityResponse = function (xmlhttp, successCallback, errorCallback) {

		if (xmlhttp.readyState !== JCL.XMLHTTPREADY) {
			return;
		}

		//check for server errors
		if (JCL._HandleErrors(xmlhttp, errorCallback)) {
			return;
		}

		var myList = [],
			resultDoc,
			attrList, // = resultDoc.getElementsByTagName("c:EntityMetadata"),
			i = 0,
			j = 0,
			xmlLabel = 'baseName',
			xmlValue = 'text',
			singleAttr,
			xmlAttr,
			canAddToSearch = '';

		if (window.DOMParser) {
			//console.log('ie 9/10');
			// IE 9/10, Chrome, Firefox & Safari
			parser = new DOMParser();
			resultDoc = parser.parseFromString(xmlhttp.responseText, "text/xml");
			//console.log('built result doc');

			attrList = resultDoc.getElementsByTagName("c:AttributeMetadata");

			if (attrList.length === 0) {
				attrList = resultDoc.getElementsByTagName("AttributeMetadata");
			}

			//console.log('built entity list: ' + entList.length);

			xmlLabel = "localName";
			xmlValue = "textContent";
		} else {
			// IE 8 and below
			resultDoc = new ActiveXObject("Microsoft.XMLDOM");
			resultDoc.async = false;
			resultDoc.loadXML(xmlhttp.responseXML.xml);
			attrList = resultDoc.getElementsByTagName("c:AttributeMetadata");
		}

		//x = resultDoc;

		for (i = 0; i < attrList.length; i++) {
			xmlAttr = attrList[i].childNodes;
			singleAttr = {};
			for (j = 0; j < xmlAttr.length; j++) {
				switch (xmlAttr[j][xmlLabel]) {
				case "DisplayName":
				case "Description":
				case "RequiredLevel":
					singleAttr[xmlAttr[j][xmlLabel]] = "";
					if (typeof xmlAttr[j].childNodes[1].childNodes[3] !== 'undefined') {
						// CRM 2011 UR 12 +
						if (xmlAttr[j].childNodes[1].childNodes[3] !== null) {
							singleAttr[xmlAttr[j][xmlLabel]] = xmlAttr[j].childNodes[1].childNodes[3][xmlValue];
						}
					} else if (typeof xmlAttr[j].childNodes[1].childNodes[1] !== 'undefined') {
						// CRM 2011 early versions
						if (typeof xmlAttr[j].childNodes[1].childNodes[1] !== null) {
							singleAttr[xmlAttr[j][xmlLabel]] = xmlAttr[j].childNodes[1].childNodes[1][xmlValue];
						}
					}
					break;

				case "AttributeType":
				case "Format":
				case "IsCustomAttribute":
				case "MetadataId":
				case "LogicalName":
				case "SchemaName":
				case "LinkedAttributeId":
				case "EntityLogicalName":
				case "IsValidForRead":
					singleAttr[xmlAttr[j][xmlLabel]] = xmlAttr[j][xmlValue];
					break;

				case "IsValidForAdvancedFind":
					singleAttr[xmlAttr[j][xmlLabel]] = xmlAttr[j][xmlValue].split("canmodifysearchsettings")[0];
					singleAttr.CanModifySearchSettings = xmlAttr[j][xmlValue].split("canmodifysearchsettings")[1];
					break;

				default:

				}
			}
			myList.push(singleAttr);
		}

		//return entities
		if (successCallback !== null) {
			successCallback(myList);
		} else {
			return myList;
		}
	};


	JCL.RetrieveAllEntitiesRequest = function (fnSuccessCallback, fnErrorCallback) {
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

		return JCL._ExecuteRequest(request, "Execute", JCL._RetrieveAllEntitiesResponse, fnSuccessCallback, fnErrorCallback);
	};

	JCL._RetrieveAllEntitiesResponse = function (xmlhttp, successCallback, errorCallback) {

		if (xmlhttp.readyState !== JCL.XMLHTTPREADY) {
			return;
		}

		//check for server errors
		if (JCL._HandleErrors(xmlhttp, errorCallback)) {
			return;
		}

		var myList = [],
			resultDoc,
			entList, // = resultDoc.getElementsByTagName("c:EntityMetadata"),
			i = 0,
			j = 0,
			k = 0,
			attr,
			curr,
			entRef,
			attrCount,
			sBase,
			xmlLabel = 'baseName',
			xmlValue = 'text';

		if (window.DOMParser) {
			//console.log('ie 9/10');
			// IE 9/10, Chrome, Firefox & Safari
			parser = new DOMParser();
			resultDoc = parser.parseFromString(xmlhttp.responseText, "text/xml");
			//console.log('built result doc');

			entList = resultDoc.getElementsByTagName("c:EntityMetadata");

			if (entList.length === 0) {
				entList = resultDoc.getElementsByTagName("EntityMetadata");
			}

			//console.log('built entity list: ' + entList.length);

			xmlLabel = "localName";
			xmlValue = "textContent";
		} else {
			// IE 8 and below
			resultDoc = new ActiveXObject("Microsoft.XMLDOM");
			resultDoc.async = false;
			resultDoc.loadXML(xmlhttp.responseXML.xml);
			entList = resultDoc.getElementsByTagName("c:EntityMetadata");
			//resultDoc = resultDoc.firstChild;

			//xmlLabel = "baseName";
			//xmlValue = "text";
		}

		//resultDoc.async = false;
		//resultDoc.loadXML(xmlhttp.responseXML.xml);

		for (i = 0; i < entList.length; i++) {
			entRef = {};
			attrCount = entList[i].childNodes.length;
			//console.log("Attributes: " + attrCount);

			for (j = 0; j < attrCount; j++) {
				sBase = entList[i].childNodes[j][xmlLabel];

				switch (sBase) {
				case "MetadataId":
				case "ObjectTypeCode":
				case "LogicalName":
				case "IsCustomEntity":
				case "PrimaryIdAttribute":
				case "PrimaryNameAttribute":
				case "IsActivityParty":
				case "IsValidForAdvancedFind":
					entRef[sBase] = entList[i].childNodes[j][xmlValue];
					break;

				case "DisplayName":
				case "Description":
				case "DisplayCollectionName":
					try {
						if (entList[i].childNodes[j].childNodes[1].childNodes.length === 5) {
							// CRM 2011 UR 12+
							entRef[sBase] = entList[i].childNodes[j].childNodes[1].childNodes[3][xmlValue];
						} else if (entList[i].childNodes[j].childNodes[1].childNodes.length === 3) {
							// pre UR 12
							entRef[sBase] = entList[i].childNodes[j].childNodes[1].childNodes[1][xmlValue];
						}
					} catch (e) {
						entRef[sBase] = "";
					}

					break;

				default:
					//entRef[sBase] = entList[i].childNodes[j][xmlValue];
				}
			}

			if (typeof entRef.DisplayName !== "undefined") {
				myList[k++] = entRef;
			}
		}

		myList.sort(JCL._SortEntityRef);

		//return entities
		if (successCallback !== null) {
			successCallback(myList);
		} else {
			return myList;
		}
	};

	JCL.GetSystemViews = function (entityTypeCode) {
		'use strict';

		var fetch = " " +
			"<fetch count='50' mapping='logical' version='1.0'>" +
			"	<entity name='savedquery'>" +
			"		<attribute name='description' />" +
			"		<attribute name='fetchxml' />" +
			"		<attribute name='isdefault' />" +
			"		<attribute name='layoutxml' />" +
			"		<attribute name='name' />" +
			"		<attribute name='organizationid' />" +
			"		<attribute name='queryapi' />" +
			"		<attribute name='querytype' />" +
			"		<attribute name='returnedtypecode' />" +
			"		<attribute name='savedqueryid' />" +
			"		<attribute name='savedqueryidunique' />" +
			"		<order attribute='name' />" +
			"		<filter>" +
			"			<condition attribute='returnedtypecode' operator='eq' value='" + entityTypeCode + "' />" +
			"			<condition attribute='querytype' operator='eq' value='0' />" +
			"			<condition attribute='fetchxml' operator='not-null' />" +
			"		</filter>" +
			"	</entity>" +
			"</fetch>";

		return JCL.Fetch(fetch);
	};

	JCL.UpdateWebResource = function (sGuid, sData, fSuccessCallback, fErrorCallback) {
		'use strict';

		var request = "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		request += "<s:Body>";
		request += '<Update xmlns="http://schemas.microsoft.com/xrm/2011/Contracts/Services">' +
			'<entity xmlns:b="http://schemas.microsoft.com/xrm/2011/Contracts" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">' +
			'<b:Attributes xmlns:c="http://schemas.datacontract.org/2004/07/System.Collections.Generic">' +
			'<b:KeyValuePairOfstringanyType>' +
			'<c:key>content</c:key>' +
			'<c:value i:type="d:string" xmlns:d="http://www.w3.org/2001/XMLSchema">' +
			'Ly8gdGVzdCBzYXZl' + // Base 64 Data
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

		return JCL._ExecuteRequest(request, "Update", JCL._GenericCallback, fSuccessCallback, fErrorCallback);
	};

	JCL.PublishWebResource = function (sGuid, fSuccessCallback, fErrorCallback) {
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

		return JCL._ExecuteRequest(request, "Execute", JCL._GenericCallback, fSuccessCallback, fErrorCallback);
	};

	JCL.GetRollup = function (guid, logicalName, relatedOrExtend, fCallback) {
		'use script';

		var request = "";
		request += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		request += "  <s:Body>";
		request += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
		request += "      <request i:type=\"b:RollupRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\" xmlns:b=\"http://schemas.microsoft.com/crm/2011/Contracts\">";
		request += "        <a:Parameters xmlns:c=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <c:key>Target</c:key>";
		request += "            <c:value i:type=\"a:EntityReference\">";
		request += "              <a:Id>" + guid + "</a:Id>";
		request += "              <a:LogicalName>" + logicalName + "</a:LogicalName>";
		request += "              <a:Name i:nil=\"true\" />";
		request += "            </c:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <c:key>Query</c:key>";
		request += "            <c:value i:type=\"a:QueryExpression\">";
		request += "              <a:ColumnSet>";
		request += "                <a:AllColumns>true</a:AllColumns>";
		request += "                <a:Columns xmlns:d=\"http://schemas.microsoft.com/2003/10/Serialization/Arrays\" />";
		request += "              </a:ColumnSet>";
		request += "              <a:Criteria>";
		request += "                <a:Conditions />";
		request += "                <a:FilterOperator>And</a:FilterOperator>";
		request += "                <a:Filters />";
		request += "              </a:Criteria>";
		request += "              <a:Distinct>true</a:Distinct>";
		request += "              <a:EntityName>activitypointer</a:EntityName>";
		request += "              <a:LinkEntities />";
		request += "              <a:Orders />";
		request += "              <a:PageInfo>";
		request += "                <a:Count>0</a:Count>";
		request += "                <a:PageNumber>0</a:PageNumber>";
		request += "                <a:PagingCookie i:nil=\"true\" />";
		request += "                <a:ReturnTotalRecordCount>true</a:ReturnTotalRecordCount>";
		request += "              </a:PageInfo>";
		request += "              <a:NoLock>false</a:NoLock>";
		request += "            </c:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "          <a:KeyValuePairOfstringanyType>";
		request += "            <c:key>RollupType</c:key>";
		request += "            <c:value i:type=\"b:RollupType\">" + relatedOrExtend + "</c:value>";
		request += "          </a:KeyValuePairOfstringanyType>";
		request += "        </a:Parameters>";
		request += "        <a:RequestId i:nil=\"true\" />";
		request += "        <a:RequestName>Rollup</a:RequestName>";
		request += "      </request>";
		request += "    </Execute>";
		request += "  </s:Body>";
		request += "</s:Envelope>";

		return JCL._ExecuteRequest(request, "Execute", JCL._FetchCallback, fCallback);
	};

	JCL.RetrievePrincipalAccessRequest = function (entityId, entityName, accessorId, accessorEntityName, successCallback, errorCallback) {
		///<summary>
		/// Executes the principal access request.  Tests whether the given entity is accessible by the given accessor (user or team).
		///</summary>
		///<param name="entityId" Type="String">
		/// The GUID of the entity to check access to.
		///</param>
		///<param name="entityName" Type="String">
		/// The entity name of the entity to check access to (account for example).
		///</param>
		///<param name="accessorId" Type="String">
		/// The GUID of the accessor (user or team) that is requesting access.
		///</param>
		///<param name="accessorEntityName" Type="String">
		/// The entity name of the accessor (user or team) that is requesting access (systemuser for example).
		///</param>
		///<param name="successCallback" Type="Function">
		/// The function to perform when an successfult response is returned.
		/// For this message no data is returned so a success callback is not really necessary.
		///</param>
		///<param name="errorCallback" Type="Function">
		/// The function to perform when an error is returned.
		/// This function accepts a JScript error returned by the _getError function
		///</param>

		var requestMain = "";
		requestMain += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		requestMain += "  <s:Body>";
		requestMain += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
		requestMain += "      <request i:type=\"b:RetrievePrincipalAccessRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\" xmlns:b=\"http://schemas.microsoft.com/crm/2011/Contracts\">";
		requestMain += "        <a:Parameters xmlns:c=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
		requestMain += "          <a:KeyValuePairOfstringanyType>";
		requestMain += "            <c:key>Target</c:key>";
		requestMain += "            <c:value i:type=\"a:EntityReference\">";
		requestMain += "              <a:Id>" + entityId + "</a:Id>";
		requestMain += "              <a:LogicalName>" + entityName + "</a:LogicalName>";
		requestMain += "              <a:Name i:nil=\"true\" />";
		requestMain += "            </c:value>";
		requestMain += "          </a:KeyValuePairOfstringanyType>";
		requestMain += "          <a:KeyValuePairOfstringanyType>";
		requestMain += "            <c:key>Principal</c:key>";
		requestMain += "            <c:value i:type=\"a:EntityReference\">";
		requestMain += "              <a:Id>" + accessorId + "</a:Id>";
		requestMain += "              <a:LogicalName>" + accessorEntityName + "</a:LogicalName>";
		requestMain += "              <a:Name i:nil=\"true\" />";
		requestMain += "            </c:value>";
		requestMain += "          </a:KeyValuePairOfstringanyType>";
		requestMain += "        </a:Parameters>";
		requestMain += "        <a:RequestId i:nil=\"true\" />";
		requestMain += "        <a:RequestName>RetrievePrincipalAccess</a:RequestName>";
		requestMain += "      </request>";
		requestMain += "    </Execute>";
		requestMain += "  </s:Body>";
		requestMain += "</s:Envelope>";

		var req = new XMLHttpRequest();
		req.open("POST", JCL._getServerUrl(), true);

		// Responses will return XML. It isn't possible to return JSON.
		req.setRequestHeader("Accept", "application/xml, text/xml, */*");
		req.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		req.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");

		req.onreadystatechange = function () {
			JCL.RetrievePrincipalAccessResponse(req, successCallback, errorCallback);
		};
		req.send(requestMain);
	};

	JCL.RetrievePrincipalAccessResponse = function (req, successCallback, errorCallback) {
		///<summary>
		/// Recieves the principal access response
		///</summary>
		///<param name="req" Type="XMLHttpRequest">
		/// The XMLHttpRequest response
		///</param>
		///<param name="successCallback" Type="Function">
		/// The function to perform when an successfult response is returned.
		/// For this message no data is returned so a success callback is not really necessary.
		///</param>
		///<param name="errorCallback" Type="Function">
		/// The function to perform when an error is returned.
		/// This function accepts a JScript error returned by the _getError function
		///</param>
		if (req.readyState == 4) {
			if (req.status == 200) {
				if (successCallback !== null) {
					successCallback();
				}
			} else {
				errorCallback(JCL._getError(req.responseXML));
			}
		}
	};

	JCL.RetrieveRolePrivilegesRoleRequest = function (roleId, successCallback, errorCallback) {
		///<summary>
		/// Returns the privileges that the given role has.
		///</summary>
		///<param name="roleId" Type="String">
		/// The GUID of the role.
		///</param>
		///<param name="successCallback" Type="Function">
		/// The function to perform when an successfult response is returned.
		/// For this message no data is returned so a success callback is not really necessary.
		///</param>
		///<param name="errorCallback" Type="Function">
		/// The function to perform when an error is returned.
		/// This function accepts a JScript error returned by the _getError function
		///</param>
		var requestMain = "";
		requestMain += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		requestMain += "  <s:Body>";
		requestMain += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
		requestMain += "      <request i:type=\"b:RetrieveRolePrivilegesRoleRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\" xmlns:b=\"http://schemas.microsoft.com/crm/2011/Contracts\">";
		requestMain += "        <a:Parameters xmlns:c=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
		requestMain += "          <a:KeyValuePairOfstringanyType>";
		requestMain += "            <c:key>RoleId</c:key>";
		requestMain += "            <c:value i:type=\"d:guid\" xmlns:d=\"http://schemas.microsoft.com/2003/10/Serialization/\">" + roleId + "</c:value>";
		requestMain += "          </a:KeyValuePairOfstringanyType>";
		requestMain += "        </a:Parameters>";
		requestMain += "        <a:RequestId i:nil=\"true\" />";
		requestMain += "        <a:RequestName>RetrieveRolePrivilegesRole</a:RequestName>";
		requestMain += "      </request>";
		requestMain += "    </Execute>";
		requestMain += "  </s:Body>";
		requestMain += "</s:Envelope>";

		var req = new XMLHttpRequest();
		req.open("POST", JCL._getServerUrl(), true);

		req.setRequestHeader("Accept", "application/xml, text/xml, */*");
		req.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		req.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");

		req.onreadystatechange = function () {
			JCL.RetrieveRolePrivilegesRoleResponse(req, successCallback, errorCallback);
		};
		req.send(requestMain);
	};

	JCL.RetrieveRolePrivilegesRoleResponse = function (req, successCallback, errorCallback) {
		///<summary>
		/// Recieves the role privileges role response
		///</summary>
		///<param name="req" Type="XMLHttpRequest">
		/// The XMLHttpRequest response
		///</param>
		///<param name="successCallback" Type="Function">
		/// The function to perform when an successfult response is returned.
		/// For this message no data is returned so a success callback is not really necessary.
		///</param>
		///<param name="errorCallback" Type="Function">
		/// The function to perform when an error is returned.
		/// This function accepts a JScript error returned by the _getError function
		///</param>
		if (req.readyState == 4) {
			if (req.status == 200) {
				alert(req.responseXML.xml);
				if (successCallback !== null) {
					successCallback();
				}
			} else {
				errorCallback(JCL._getError(req.responseXML));
			}
		}
	};

	JCL.RetrieveUserPrivilegesRequest = function (userId, successCallback, errorCallback) {
		var requestMain = "";
		requestMain += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		requestMain += "  <s:Body>";
		requestMain += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
		requestMain += "      <request i:type=\"b:RetrieveUserPrivilegesRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\" xmlns:b=\"http://schemas.microsoft.com/crm/2011/Contracts\">";
		requestMain += "        <a:Parameters xmlns:c=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
		requestMain += "          <a:KeyValuePairOfstringanyType>";
		requestMain += "            <c:key>UserId</c:key>";
		requestMain += "            <c:value i:type=\"d:guid\" xmlns:d=\"http://schemas.microsoft.com/2003/10/Serialization/\">" + userId + "</c:value>";
		requestMain += "          </a:KeyValuePairOfstringanyType>";
		requestMain += "        </a:Parameters>";
		requestMain += "        <a:RequestId i:nil=\"true\" />";
		requestMain += "        <a:RequestName>RetrieveUserPrivileges</a:RequestName>";
		requestMain += "      </request>";
		requestMain += "    </Execute>";
		requestMain += "  </s:Body>";
		requestMain += "</s:Envelope>";

		var req = new XMLHttpRequest();
		req.open("POST", JCL._getServerUrl(), true);

		req.setRequestHeader("Accept", "application/xml, text/xml, */*");
		req.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		req.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");

		req.onreadystatechange = function () {
			JCL.RetrieveUserPrivilegesResponse(req, successCallback, errorCallback);
		};
		req.send(requestMain);
	};

	JCL.RetrieveUserPrivilegesResponse = function (req, successCallback, errorCallback) {
		///<summary>
		/// Recieves the user privileges response
		///</summary>
		///<param name="req" Type="XMLHttpRequest">
		/// The XMLHttpRequest response
		///</param>
		///<param name="successCallback" Type="Function">
		/// The function to perform when an successfult response is returned.
		/// For this message no data is returned so a success callback is not really necessary.
		///</param>
		///<param name="errorCallback" Type="Function">
		/// The function to perform when an error is returned.
		/// This function accepts a JScript error returned by the _getError function
		///</param>
		if (req.readyState == 4) {
			if (req.status == 200) {
				alert(req.responseXML.xml);
				if (successCallback !== null) {
					successCallback();
				}
			} else {
				errorCallback(JCL._getError(req.responseXML));
			}
		}
	};

	JCL.getXhr = function () {
		///<summary>
		/// Get an instance of XMLHttpRequest for all browsers
		///</summary>
		if (XMLHttpRequest) {
			// Chrome, Firefox, IE7+, Opera, Safari
			// ReSharper disable InconsistentNaming
			return new XMLHttpRequest();
			// ReSharper restore InconsistentNaming
		}
		// IE6
		try {
			// The latest stable version. It has the best security, performance,
			// reliability, and W3C conformance. Ships with Vista, and available
			// with other OS's via downloads and updates.
			return new ActiveXObject('MSXML2.XMLHTTP.6.0');
		} catch (e) {
			try {
				// The fallback.
				return new ActiveXObject('MSXML2.XMLHTTP.3.0');
			} catch (e2) {
				alert('This browser is not AJAX enabled.');
				return null;
			}
		}
	};

	JCL.errorHandler = function (req) {
		///<summary>
		/// Private function return an Error object to the errorCallback
		///</summary>
		///<param name="req" type="XMLHttpRequest">
		/// The XMLHttpRequest response that returned an error.
		///</param>
		///<returns>Error</returns>

		var errorMessage = '';
		if (req.responseText !== "") {
			errorMessage = JSON.parse(req.responseText).error.message.value;
		}

		return new Error("Error : " + req.status + ": " + req.statusText + ": " + errorMessage);
	};

	JCL.CreateRecord = function (object, type, successCallback, errorCallback, async) {
		var req = JCL.getXhr();

		req.open("POST", JCL.oDataPath() + type, async);
		req.setRequestHeader("Accept", "application/json");
		req.setRequestHeader("Content-Type", "application/json; charset=utf-8");

		req.onreadystatechange = function () {
			if (this.readyState === 4 /* complete */ ) {
				if (this.status === 201) {
					successCallback(JSON.parse(this.responseText, JCL._DateReviver).d);
				} else {
					errorCallback(JCL.errorHandler(this));
				}
			}
		};
		req.send(JSON.stringify(object));
	};

	JCL.UpdateRecord = function (id, object, type, successCallback, errorCallback, async) {
		var req = JCL.getXhr();

		req.open("POST", JCL.oDataPath() + type + "(guid'" + id + "')", async);
		req.setRequestHeader("Accept", "application/json");
		req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
		req.setRequestHeader("X-HTTP-Method", "MERGE");

		req.onreadystatechange = function () {
			if (this.readyState === 4 /* complete */ ) {
				if (this.status === 204 || this.status === 1223) {
					successCallback();
				} else {
					errorCallback(JCL.errorHandler(this));
				}
			}
		};
		req.send(JSON.stringify(object));
	};

	JCL.DeleteRecord = function (id, type, successCallback, errorCallback, async) {
		var req = JCL.getXhr();

		req.open("POST", JCL.oDataPath() + type + "(guid'" + id + "')", async);
		req.setRequestHeader("Accept", "application/json");
		req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
		req.setRequestHeader("X-HTTP-Method", "DELETE");

		req.onreadystatechange = function () {
			if (this.readyState === 4 /* complete */ ) {
				if (this.status === 204 || this.status === 1223) {
					successCallback();
				} else {
					errorCallback(JCL.errorHandler(this));
				}
			}
		};
		req.send();
	};

	JCL.AssociateRecord = function (id1, type1, id2, type2, relationshipSchemaName, successCallback, errorCallback, async) {
		var entity2 = {};
		entity2.uri = JCL.oDataPath() + type2 + "Set(guid'" + id2 + "')";
		var jsonEntity = JSON.stringify(entity2);

		var req = JCL.getXhr();

		req.open("POST", JCL.oDataPath() + type1 + "Set(guid'" + id1 + "')/$links/" + relationshipSchemaName, async);
		req.setRequestHeader("Accept", "application/json");
		req.setRequestHeader("Content-Type", "application/json; charset=utf-8");

		req.onreadystatechange = function () {
			if (this.readyState === 4 /* complete */ ) {
				if (this.status === 204 || this.status === 1223) {
					if (successCallback !== null) {
						successCallback();
					}
				} else {
					if (errorCallback !== null) {
						errorCallback(JCL.errorHandler(this));
					}
				}
			}
		};
		req.send(jsonEntity);
	};

	JCL.DisassociateRecord = function (id1, type1, id2, relationshipSchemaName, successCallback, errorCallback, async) {

		var req = JCL.getXhr();

		req.open("POST", JCL.oDataPath() + type1 + "Set(guid'" + id1 + "')/$links/" + relationshipSchemaName + "(guid'" + id2 + "')", async);
		req.setRequestHeader("Accept", "application/json");
		req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
		req.setRequestHeader("X-HTTP-Method", "DELETE");

		req.onreadystatechange = function () {
			if (this.readyState === 4 /* complete */ ) {
				if (this.status === 204 || this.status === 1223) {
					successCallback();
				} else {
					errorCallback(JCL.errorHandler(this));
				}
			}
		};
		req.send();
	};

	JCL._getServerUrl = function () {
		///<summary>
		/// Returns the URL for the SOAP endpoint using the context information available in the form
		/// or HTML Web resource.
		///</summary>
		var OrgServicePath = "/XRMServices/2011/Organization.svc/web";
		var serverUrl = "";
		if (typeof GetGlobalContext == "function") {
			var context = GetGlobalContext();
			serverUrl = context.getServerUrl();
		} else {
			if (typeof Xrm.Page.context == "object") {
				serverUrl = Xrm.Page.context.getServerUrl();
			} else {
				throw new Error("Unable to access the server URL");
			}
		}
		if (serverUrl.match(/\/$/)) {
			serverUrl = serverUrl.substring(0, serverUrl.length - 1);
		}
		return serverUrl + OrgServicePath;
	};

	JCL.Assign = function (targetId, targetEntityName, assigneeId, assigneeEntityName, successCallback, errorCallback) {
		///<summary>
		/// Sends synchronous/asynchronous request to assign an existing record to a user / a team.
		///</summary>
		///<param name="targetId" type="String">
		/// A JavaScript String corresponding to the GUID of the target entity
		/// that is used for assign operations.
		/// </param>
		///<param name="targetEntityName" type="String">
		/// A JavaScript String corresponding to the schema name of the target entity
		/// that is used for assign operations.
		/// </param>
		///<param name="assigneeId" type="String">
		/// A JavaScript String corresponding to the GUID of the assignee entity
		/// that is used for assign operations.
		/// </param>
		///<param name="assigneeEntityName" type="String">
		/// A JavaScript String corresponding to the schema name of the assignee entity
		/// that is used for assign operations.
		/// </param>
		///<param name="callback" type="Function">
		/// A Function used for asynchronous request. If not defined, it sends a synchronous request.
		/// </param>

		var request = "" +
			"<soap:Envelope xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'>" +
			"	<soap:Body>" +
			"		<Execute xmlns='http://schemas.microsoft.com/xrm/2011/Contracts/Services' xmlns:i='http://www.w3.org/2001/XMLSchema-instance'>" +
			"			<request i:type='b:AssignRequest' xmlns:a='http://schemas.microsoft.com/xrm/2011/Contracts' xmlns:b='http://schemas.microsoft.com/crm/2011/Contracts'>" +
			"				<a:Parameters xmlns:c='http://schemas.datacontract.org/2004/07/System.Collections.Generic'>" +
			"					<a:KeyValuePairOfstringanyType>" +
			"						<c:key>Target</c:key>" +
			"						<c:value i:type='a:EntityReference'>" +
			"							<a:Id>" + targetId + "</a:Id>" +
			"							<a:LogicalName>" + targetEntityName + "</a:LogicalName>" +
			"							<a:Name i:nil='true' />" +
			"						</c:value>" +
			"					</a:KeyValuePairOfstringanyType>" +
			"					<a:KeyValuePairOfstringanyType>" +
			"						<c:key>Assignee</c:key>" +
			"						<c:value i:type='a:EntityReference'>" +
			"							<a:Id>" + assigneeId + "</a:Id>" +
			"							<a:LogicalName>" + assigneeEntityName + "</a:LogicalName>" +
			"							<a:Name i:nil='true' />" +
			"						</c:value>" +
			"					</a:KeyValuePairOfstringanyType>" +
			"				</a:Parameters>" +
			"				<a:RequestId i:nil='true' />" +
			"				<a:RequestName>Assign</a:RequestName>" +
			"			</request>" +
			"		</Execute>" +
			"	</soap:Body>" +
			"</soap:Envelope>";

		var req = new XMLHttpRequest();
		req.open("POST", JCL._getServerUrl(), true);

		// Responses will return XML. It isn't possible to return JSON.
		req.setRequestHeader("Accept", "application/xml, text/xml, */*");
		req.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		req.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");

		req.onreadystatechange = function () {
			JCL.SetStateResponse(req, successCallback, errorCallback);
		};
		req.send(request);
	};

	/*
SetStateRequest functionality guided by...
http://mileyja.blogspot.com/2011/07/set-status-or-state-of-record-using.html
 */
	JCL.SetStateRequest = function (id, type, state, status, successCallback, errorCallback) {
		var requestMain = "";
		requestMain += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
		requestMain += "  <s:Body>";
		requestMain += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
		requestMain += "      <request i:type=\"b:SetStateRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\" xmlns:b=\"http://schemas.microsoft.com/crm/2011/Contracts\">";
		requestMain += "        <a:Parameters xmlns:c=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
		requestMain += "          <a:KeyValuePairOfstringanyType>";
		requestMain += "            <c:key>EntityMoniker</c:key>";
		requestMain += "            <c:value i:type=\"a:EntityReference\">";
		requestMain += "              <a:Id>" + id + "</a:Id>";
		requestMain += "              <a:LogicalName>" + type + "</a:LogicalName>";
		requestMain += "              <a:Name i:nil=\"true\" />";
		requestMain += "            </c:value>";
		requestMain += "          </a:KeyValuePairOfstringanyType>";
		requestMain += "          <a:KeyValuePairOfstringanyType>";
		requestMain += "            <c:key>State</c:key>";
		requestMain += "            <c:value i:type=\"a:OptionSetValue\">";
		requestMain += "              <a:Value>" + state + "</a:Value>";
		requestMain += "            </c:value>";
		requestMain += "          </a:KeyValuePairOfstringanyType>";
		requestMain += "          <a:KeyValuePairOfstringanyType>";
		requestMain += "            <c:key>Status</c:key>";
		requestMain += "            <c:value i:type=\"a:OptionSetValue\">";
		requestMain += "              <a:Value>" + status + "</a:Value>";
		requestMain += "            </c:value>";
		requestMain += "          </a:KeyValuePairOfstringanyType>";
		requestMain += "        </a:Parameters>";
		requestMain += "        <a:RequestId i:nil=\"true\" />";
		requestMain += "        <a:RequestName>SetState</a:RequestName>";
		requestMain += "      </request>";
		requestMain += "    </Execute>";
		requestMain += "  </s:Body>";
		requestMain += "</s:Envelope>";
		var req = new XMLHttpRequest();
		req.open("POST", JCL._getServerUrl(), true);

		// Responses will return XML. It isn't possible to return JSON.
		req.setRequestHeader("Accept", "application/xml, text/xml, */*");
		req.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
		req.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");

		req.onreadystatechange = function () {
			JCL.SetStateResponse(req, successCallback, errorCallback);
		};
		req.send(requestMain);
	};

	JCL.SetStateResponse = function (req, successCallback, errorCallback) {
		///<summary>
		/// Recieves the assign response
		///</summary>
		///<param name="req" Type="XMLHttpRequest">
		/// The XMLHttpRequest response
		///</param>
		///<param name="successCallback" Type="Function">
		/// The function to perform when an successfult response is returned.
		/// For this message no data is returned so a success callback is not really necessary.
		///</param>
		///<param name="errorCallback" Type="Function">
		/// The function to perform when an error is returned.
		/// This function accepts a JScript error returned by the _getError function
		///</param>
		if (req.readyState == 4) {
			if (req.status == 200) {
				if (successCallback !== null) {
					successCallback();
				}
			} else {
				errorCallback(JCL._getError(req.responseXML));
			}
		}
	};

	JCL.GetPrivilege = function (entityName, privilegeType, userId, successCallback, errorCallback) {
		///<summary>
		/// Returns the privilege for the given entity, type, and user.
		///</summary>
		///<param name="entityName" Type="String">
		/// The entity name of the entity to check access to (account for example).
		///</param>
		///<param name="privilegeType" Type="String">
		/// The pivilege type: 'Write', 'Delete', etc.
		///</param>
		///<param name="userId" Type="String">
		/// The guid of the user.
		///</param>
		///<param name="successCallback" Type="Function">
		/// The function to perform when an successfult response is returned.
		///</param>
		///<param name="errorCallback" Type="Function">
		/// The function to perform when an error is returned.
		/// This function accepts a JScript error returned by the _getError function
		///</param>
		var fetch = "<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='true'>" +
			"	<entity name='privilege'>" +
			"		<all-attributes />" +
			"		<filter type='and'>" +
			"			<condition attribute='name' operator='eq' value='prv" + privilegeType + entityName + "'/>" +
			"		</filter>" +
			"		<link-entity name='roleprivileges' from='privilegeid' to='privilegeid' alias='rp'>" +
			"			<all-attributes />" +
			"			<link-entity name='systemuserroles' from='roleid' to='roleid' visible='false' intersect='true'>" +
			"				<filter type='and'>" +
			"					<condition attribute='systemuserid' operator='eq' value='" + userId + "' />" +
			"				</filter>" +
			"			</link-entity>" +
			"		</link-entity>" +
			"	</entity>" +
			"</fetch>";

		JCL.Fetch(fetch, successCallback, errorCallback);
	};

	JCL._getError = function (faultXml) {
		///<summary>
		/// Parses the WCF fault returned in the event of an error.
		///</summary>
		///<param name="faultXml" Type="XML">
		/// The responseXML property of the XMLHttpRequest response.
		///</param>
		var errorMessage = "Unknown Error (Unable to parse the fault)";
		if (typeof faultXml == "object") {
			try {
				var bodyNode = faultXml.firstChild.firstChild;
				//Retrieve the fault node
				for (var i = 0; i < bodyNode.childNodes.length; i++) {
					var node = bodyNode.childNodes[i];
					//NOTE: This comparison does not handle the case where the XML namespace changes
					if ("s:Fault" == node.nodeName) {
						for (var j = 0; j < node.childNodes.length; j++) {
							var faultStringNode = node.childNodes[j];
							if ("faultstring" == faultStringNode.nodeName) {
								errorMessage = faultStringNode.text;
								break;
							}
						}
						break;
					}
				}
			} catch (e) {}
		}
		return new Error(errorMessage);
	};

	JCL.RemoveParams = function (guid) {
		return guid.replace('%7b', '').replace('%7d', '');
	};

	JCL.GetUrlParameter = function (name) {
		name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");

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
		// +   improved by: Rafal Kukawski (http://kukawski.pl)
		// +   improved by: Paul Way (www.paul-way.com)
		// *     example 1: base64_encode('Kevin van Zonneveld');
		// *     returns 1: 'S2V2aW4gdmFuIFpvbm5ldmVsZA=='

		var o1,
			o2,
			o3,
			h1,
			h2,
			h3,
			h4,
			r,
			bits,
			i = 0,
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

	JCL._DateReviver = function (key, value) {
		var a;
		if (typeof value === 'string') {
			a = /Date\(([-+]?\d+)\)/.exec(value);
			if (a) {
				return new Date(parseInt(value.replace("/Date(", "").replace(")/", ""), 10));
			}
		}
		return value;
	};

}());