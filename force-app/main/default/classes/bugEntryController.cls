/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : bugEntryController
 * Author          : <YourName>
 * Created Date    : Feb 3, 2026
 * Last Modified By: <YourName>
 * Last Modified On: Feb 3, 2026
 * Description     : This class implements for......
 *  
 * Change History  :
 *  Date          │   Author     │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Feb 3, 2026  │ <YourName>   │ Initial version
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */

public class bugEntryController {

	@AuraEnabled
    public static void uploadFile(String fileName,String base64Data,String contentType,String referenceKey) {
        ContentVersion cv = new ContentVersion();
        cv.Title = fileName;
        cv.PathOnClient = fileName;
        cv.VersionData = EncodingUtil.base64Decode(base64Data);
        cv.Form_Reference_FileUpload__c = referenceKey;
        insert cv;

		// List<ContentVersion> versions = [SELECT ContentDocumentId FROM ContentVersion WHERE Form_Reference_FileUpload__c = :referenceKey];

		// List<ContentDocumentLink> links = new List<ContentDocumentLink>();
		// for (ContentVersion v : versions) {
		// 	links.add(new ContentDocumentLink(
		// 		ContentDocumentId = v.ContentDocumentId,
		// 		LinkedEntityId = recordId,
		// 		ShareType = 'V'
		// 	));
		// }
		// insert links;
    }
}