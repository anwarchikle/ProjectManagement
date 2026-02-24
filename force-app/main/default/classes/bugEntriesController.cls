/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : bugEntriesController
 * Author          : <Md Anwar Chikle>
 * Created Date    : Feb 3, 2026
 * Last Modified By: <Md Anwar Chikle>
 * Last Modified On: Feb 3, 2026
 * Description     : This class implements for......
 *  
 * Change History  :
 *  Date          │   Author     │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Feb 3, 2026  │ <Md Anwar Chikle>   │ Initial version
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */

public class bugEntriesController {

    @AuraEnabled
    public static String createBugEntries(
        List<Map<String, Object>> bugEntries,
        Map<String, String> projectDetails
    ) {
        try {

            if (bugEntries == null || bugEntries.isEmpty()) {
                return 'No bug entries received';
            }

            // 🔹 Get Team Lead once
            Id teamLeadId;
            List<Project_Team_Member__c> projectTeamMemberList = [
                SELECT Id,Assigned_To__c
                FROM Project_Team_Member__c 
                WHERE Role__c = 'Team Lead'
                LIMIT 1
            ];

            if (!projectTeamMemberList.isEmpty()) {
                teamLeadId = projectTeamMemberList[0].Assigned_To__c;
            }

            List<Issue_Bug__c> bugsToInsert = new List<Issue_Bug__c>();

            for (Map<String, Object> bugMap : bugEntries) {

                Issue_Bug__c bug = new Issue_Bug__c();
                bug.Name                  = (String) bugMap.get('title');
                bug.Description__c        = (String) bugMap.get('description');
               	bug.Severity__c             = (String) bugMap.get('severity');
                bug.Type__c               = (String) bugMap.get('type');
                bug.Steps_To_Reproduce__c = (String) bugMap.get('stepsToReproduce');
                bug.Expected_Result__c    = (String) bugMap.get('expectedResult');
                bug.Actual_Result__c      = (String) bugMap.get('actualResult');

                if (String.isNotBlank(projectDetails.get('projectId'))) {
                    bug.Project__c = (Id) projectDetails.get('projectId');
                }

                if (String.isNotBlank(projectDetails.get('milestoneId'))) {
                    bug.Affected_Milestone__c = (Id) projectDetails.get('milestoneId');
                }

                if (String.isNotBlank(projectDetails.get('taskListId'))) {
                    //bug.Task_List__c = (Id) projectDetails.get('taskListId');
                }

                bug.Environment__c = projectDetails.get('environment');
                bug.Assignee__c    = teamLeadId;

                bugsToInsert.add(bug);
            }

            // 🔹 Insert Bugs
            insert bugsToInsert;

            // 🔹 Prepare Files
            List<ContentVersion> versionsToInsert = new List<ContentVersion>();

            Integer bugIndex = 0;

            for (Map<String, Object> bugMap : bugEntries) {

                if (bugMap.containsKey('files') && bugMap.get('files') != null) {

                    List<Object> files = (List<Object>) bugMap.get('files');

                    for (Object fileObj : files) {

                        Map<Object, Object> fileMap = (Map<Object, Object>) fileObj;

                        String base64Data = (String) fileMap.get('base64Data');
                        String fileName   = (String) fileMap.get('fileName');

                        if (String.isNotBlank(base64Data) && String.isNotBlank(fileName)) {

                            ContentVersion cv = new ContentVersion();
                            cv.Title = fileName;
                            cv.PathOnClient = fileName;
                            cv.VersionData = EncodingUtil.base64Decode(base64Data);

                            // 🔥 This auto-links file to Bug
                            cv.FirstPublishLocationId = bugsToInsert[bugIndex].Id;

                            versionsToInsert.add(cv);
                        }
                    }
                }

                bugIndex++;
            }

            if (!versionsToInsert.isEmpty()) {
                insert versionsToInsert;
            }

            return 'SUCCESS';

        } catch (Exception e) {
            System.debug('Error ===> ' + e.getMessage() + 
                         ' | Line ===> ' + e.getLineNumber());
            return e.getMessage();
        }
    }
}