public class ChangeRequestController {

    public class ChangeRequestInput {
        @AuraEnabled public String title;
        @AuraEnabled public String description;
        @AuraEnabled public String fileName;
        @AuraEnabled public String fileBody;
    }

    // ─── NEW: Returns the current user's profile name ───────────────────────────
    @AuraEnabled(cacheable=true)
    public static String getCurrentUserProfile() {
        try {
            User u = [
                SELECT Profile.Name
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            return u.Profile.Name;
        } catch (Exception e) {
            System.debug('Error fetching profile: ' + e.getMessage());
            return null;
        }
    }

    // ─── NEW: Returns all projects (for PMT Project Manager dropdown) ────────────
    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjectsForPMT() {
        try {
            return [
                SELECT Id, Name
                FROM Project__c
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            System.debug('Error fetching projects: ' + e.getMessage());
            return new List<Project__c>();
        }
    }

    @AuraEnabled
    public static Id createChangeRequestForCurrentUser() {
        try {
            User u = [SELECT Id, ContactId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            if (u.ContactId == null) {
                return null;
            }

            Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = :u.ContactId LIMIT 1];
            if (c.AccountId == null) {
                return null;
            }

            List<Project__c> projects = [
                SELECT Id, Customer__c
                FROM Project__c
                WHERE Customer__c = :c.AccountId
                LIMIT 1
            ];

            if (projects.isEmpty()) {
                return null;
            }

            Project__c proj = projects[0];

            List<Milestone__c> milestones = [
                SELECT Id
                FROM Milestone__c
                WHERE Project__c = :proj.Id
                AND Name = 'Change Request'
                LIMIT 1
            ];

            if (milestones.isEmpty()) {
                return null;
            }

            Milestone__c milestone = milestones[0];

            List<Task_List__c> taskLists = [
                SELECT Id
                FROM Task_List__c
                WHERE Milestone__c = :milestone.Id
                AND Name = 'Change Request'
                LIMIT 1
            ];

            if (taskLists.isEmpty()) {
                return null;
            }

            Task_List__c taskList = taskLists[0];

            Change_Request__c changeRequest = new Change_Request__c();
            changeRequest.Task_List__c = taskList.Id;
            changeRequest.Title__c = 'New Change Request';
            changeRequest.Description__c = 'Created from Change Request quick action for current user.';

            insert changeRequest;

            return changeRequest.Id;
        } catch (Exception e) {
            System.debug(' error message ====> ' + e.getMessage() + ' at line number ====> ' + e.getLineNumber());
            return null;
        }
    }

    @AuraEnabled
    public static List<Id> createChangeRequestsBatchForCurrentUser(List<Map<String, Object>> inputs) {
        List<Id> createdIds = new List<Id>();
        System.debug('inputs ====> ' + JSON.serialize(inputs));
        if (inputs == null || inputs.isEmpty()) {
            return createdIds;
        }

        try {
            User u = [SELECT Id, ContactId, Profile.Name FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            Boolean isPMT = (u.Profile.Name == 'PMT Project Manager');

            // For non-PMT users, resolve via Contact -> Account as before
            Id resolvedAccountId = null;
            if (!isPMT) {
                if (u.ContactId == null) return createdIds;
                Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = :u.ContactId LIMIT 1];
                if (c.AccountId == null) return createdIds;
                resolvedAccountId = c.AccountId;
            }

            // Build Change Requests
            List<Change_Request__c> toInsert = new List<Change_Request__c>();
            List<Map<String, Object>> matchingInputs = new List<Map<String, Object>>();

            for (Map<String, Object> input : inputs) {
                String title       = (String) input.get('title');
                String description = (String) input.get('description');
                String projectId   = (String) input.get('projectId');

                Boolean titleEmpty = (title == null || title.trim() == '');
                Boolean descEmpty  = (description == null || description.trim() == '');
                if (titleEmpty && descEmpty) continue;

                // Resolve Task List
                Id taskListId = null;

                if (isPMT && projectId != null && projectId.trim() != '') {
                    // PMT path: use the selected project directly
                    taskListId = resolveTaskListId(Id.valueOf(projectId));
                } else if (!isPMT) {
                    // Standard path: use account-derived project
                    taskListId = resolveTaskListIdByAccount(resolvedAccountId);
                }

                if (taskListId == null) continue;

                Change_Request__c cr = new Change_Request__c();
                cr.Task_List__c    = taskListId;
                cr.Title__c        = title;
                cr.Description__c  = description;
                toInsert.add(cr);
                matchingInputs.add(input);
            }

            if (!toInsert.isEmpty()) {
                insert toInsert;

                for (Change_Request__c crInserted : toInsert) {
                    createdIds.add(crInserted.Id);
                }

                List<ContentVersion> contentVersions = new List<ContentVersion>();
                for (Integer i = 0; i < toInsert.size(); i++) {
                    Change_Request__c cr = toInsert[i];
                    Map<String, Object> input = matchingInputs[i];

                    String fileBody = (String) input.get('fileBody');
                    String fileName = (String) input.get('fileName');

                    if (fileBody != null && fileBody.trim() != '') {
                        ContentVersion cv = new ContentVersion();
                        cv.Title = (fileName == null || fileName.trim() == '')
                            ? 'Change Request File'
                            : fileName;
                        cv.PathOnClient = cv.Title;
                        cv.VersionData = EncodingUtil.base64Decode(fileBody);
                        cv.FirstPublishLocationId = cr.Id;
                        contentVersions.add(cv);
                    }
                }

                if (!contentVersions.isEmpty()) {
                    insert contentVersions;
                }
            }

            return createdIds;
        } catch (Exception e) {
            System.debug(' error message (batch) ====> ' + e.getMessage() + ' at line number ====> ' + e.getLineNumber());
            return createdIds;
        }
    }

    // ─── Helper: resolve Task List Id from a given Project Id ───────────────────
    private static Id resolveTaskListId(Id projectId) {
        List<Milestone__c> milestones = [
            SELECT Id FROM Milestone__c
            WHERE Project__c = :projectId AND Name = 'Change Request'
            LIMIT 1
        ];
        if (milestones.isEmpty()) return null;

        List<Task_List__c> taskLists = [
            SELECT Id FROM Task_List__c
            WHERE Milestone__c = :milestones[0].Id AND Name = 'Change Request'
            LIMIT 1
        ];
        return taskLists.isEmpty() ? null : taskLists[0].Id;
    }

    // ─── Helper: resolve Task List Id from Account (non-PMT path) ───────────────
    private static Id resolveTaskListIdByAccount(Id accountId) {
        List<Project__c> projects = [
            SELECT Id FROM Project__c WHERE Customer__c = :accountId LIMIT 1
        ];
        if (projects.isEmpty()) return null;
        return resolveTaskListId(projects[0].Id);
    }

    @AuraEnabled(cacheable=true)
    public static List<Change_Request__c> getChangeRequestsForCurrentUserProject() {
        List<Change_Request__c> result = new List<Change_Request__c>();

        try {
            User u = [SELECT Id, ContactId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            if (u.ContactId == null) {
                return result;
            }

            Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = :u.ContactId LIMIT 1];
            if (c.AccountId == null) {
                return result;
            }

            List<Project__c> projects = [
                SELECT Id, Customer__c
                FROM Project__c
                WHERE Customer__c = :c.AccountId
                LIMIT 1
            ];

            if (projects.isEmpty()) {
                return result;
            }

            Project__c proj = projects[0];

            List<Milestone__c> milestones = [
                SELECT Id
                FROM Milestone__c
                WHERE Project__c = :proj.Id
                AND Name = 'Change Request'
                LIMIT 1
            ];

            if (milestones.isEmpty()) {
                return result;
            }

            Milestone__c milestone = milestones[0];

            List<Task_List__c> taskLists = [
                SELECT Id
                FROM Task_List__c
                WHERE Milestone__c = :milestone.Id
                AND Name = 'Change Request'
            ];

            if (taskLists.isEmpty()) {
                return result;
            }

            Set<Id> taskListIds = new Set<Id>();
            for (Task_List__c tl : taskLists) {
                taskListIds.add(tl.Id);
            }

            result = [
                SELECT Id, Name, Title__c, Description__c, Estimated_Hours__c, Impact__c,
                       Decision_By__r.Name, Decision_Date__c, Type__c, CR_Decision__c,
                       CreatedDate, LastModifiedDate
                FROM Change_Request__c
                WHERE Task_List__c IN :taskListIds
                ORDER BY CreatedDate DESC
            ];

            return result;
        } catch (Exception e) {
            System.debug(' error message (get list) ====> ' + e.getMessage() + ' at line number ====> ' + e.getLineNumber());
            return result;
        }
    }
}