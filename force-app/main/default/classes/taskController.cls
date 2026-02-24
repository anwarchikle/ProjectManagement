public with sharing class taskController {

    /* ---------- KANBAN TASKS ---------- */
    @AuraEnabled(cacheable=true)
    public static List<Tasks__c> getTasks(String status) {
        String st = String.isBlank(status) ? null : status.trim();
        if (st == null) {
            return [
                SELECT Id, Name, Status__c, Priority__c, Start_Date__c, End_Date__c
                FROM Tasks__c
                ORDER BY LastModifiedDate DESC
                LIMIT 200
            ];
        }

        return [
            SELECT Id, Name, Status__c, Priority__c, Start_Date__c, End_Date__c
            FROM Tasks__c
            WHERE Status__c = :st
            ORDER BY LastModifiedDate DESC
            LIMIT 200
        ];
    }

    @AuraEnabled
    public static void updateTaskStatus(Id taskId, String newStatus) {
        if (taskId == null || String.isBlank(newStatus)) {
            throw new AuraHandledException('Task Id or Status is missing');
        }

        Tasks__c t = [SELECT Id, Status__c FROM Tasks__c WHERE Id = :taskId LIMIT 1];
        t.Status__c = newStatus.trim();
        update t;
    }

    @AuraEnabled(cacheable=true)
    public static List<ListViewOption> getTaskListViews() {
        List<ListViewOption> results = new List<ListViewOption>();

        results.add(new ListViewOption('All', 'All'));

        for (ListView lv : [
            SELECT Name, DeveloperName
            FROM ListView
            WHERE SobjectType = 'Tasks__c'
            ORDER BY Name
        ]) {
            if (String.isBlank(lv.DeveloperName) || lv.DeveloperName == 'All') {
                continue;
            }
            results.add(new ListViewOption(lv.Name, lv.DeveloperName));
        }

        return results;
    }

    public class ListViewOption {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String value { get; set; }

        public ListViewOption(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }
    
    /* ---------- SEARCH USERS ---------- */
    @AuraEnabled(cacheable=true)
    public static List<User> searchUsers(String searchKey) {
        if (String.isBlank(searchKey) || searchKey.length() < 2) {
            return new List<User>();
        }
        String searchTerm = '%' + String.escapeSingleQuotes(searchKey) + '%';
        return [
            SELECT Id, Name, FirstName, LastName FROM User
            WHERE (Name LIKE :searchTerm OR FirstName LIKE :searchTerm OR LastName LIKE :searchTerm)
            ORDER BY Name LIMIT 30
        ];
    }
    
    /* ---------- ASSIGN TASK OWNERS ---------- */
    @AuraEnabled
    public static String assignTaskOwners(Id taskId, List<Id> userIds) {
        if (taskId == null || userIds == null || userIds.isEmpty()) {
            throw new AuraHandledException('Task Id or Users are missing');
        }
        // Fetch existing users for this Task
        Set<Id> existingUsers = new Set<Id>();
        for (Task_Owner__c rec : [SELECT User__c FROM Task_Owner__c WHERE Tasks__c = :taskId]) {
            existingUsers.add(rec.User__c);
        }
        List<Task_Owner__c> toInsert = new List<Task_Owner__c>();
        Integer duplicateCount = 0;
        for (Id userId : userIds) {
            if (!existingUsers.contains(userId)) {
                toInsert.add(new Task_Owner__c(Tasks__c = taskId, User__c = userId));
            } else {
                duplicateCount++;
            }
        }
        Integer insertedCount = 0;
        if (!toInsert.isEmpty()) {
            insert toInsert;
            insertedCount = toInsert.size();
        }
        // Build a message string
        String message = '';
        if (insertedCount > 0) {
            message += insertedCount + ' user(s) assigned';
        }
        if (duplicateCount > 0) {
            if (message != '') message += ', ';
            message += duplicateCount + ' duplicate(s) skipped';
        }
        if (message == '') message = 'No users selected';
        return message;
    }
    
    /* ---------- PROJECT TEAM MEMBERS WITH DETAILS ---------- */
    @AuraEnabled(cacheable=true)
    public static List<UserDetailsWrapper> getUserDetails(List<Id> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return new List<UserDetailsWrapper>();
        }

        List<UserDetailsWrapper> results = new List<UserDetailsWrapper>();

        for (User u : [
            SELECT Id, Name, Rate_Per_Hour__c, Role__c
            FROM User
            WHERE Id IN :userIds
        ]) {
            UserDetailsWrapper w = new UserDetailsWrapper();
            w.userId = u.Id;
            w.name = u.Name;
            w.ratePerHour = u.Rate_Per_Hour__c;
            w.role = u.Role__c;
            w.allocationPercent = 0;
            w.isActive = true;
            results.add(w);
        }

        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<UserDetailsWrapper> getProjectTeamMembers(Id projectId) {
        if (projectId == null) {
            return new List<UserDetailsWrapper>();
        }

        List<UserDetailsWrapper> results = new List<UserDetailsWrapper>();

        for (Project_Team_Member__c ptm : [
            SELECT Id, Project__c, Assigned_To__c, Assigned_To__r.Name,
                   Role__c, Rate_Per_Hour__c, Allocation__c, Is_Active__c
            FROM Project_Team_Member__c
            WHERE Project__c = :projectId
        ]) {
            UserDetailsWrapper w = new UserDetailsWrapper();
            w.userId = ptm.Assigned_To__c;
            w.name = ptm.Assigned_To__r != null ? ptm.Assigned_To__r.Name : null;
            w.ratePerHour = ptm.Rate_Per_Hour__c;
            w.role = ptm.Role__c;
            w.allocationPercent = ptm.Allocation__c;
            w.isActive = ptm.Is_Active__c;
            results.add(w);
        }

        return results;
    }

    @AuraEnabled
    public static String assignProjectMembersWithDetails(Id projectId, List<UserAllocationWrapper> allocations) {
        if (projectId == null || allocations == null || allocations.isEmpty()) {
            throw new AuraHandledException('Project Id or allocations are missing');
        }

        Set<Id> userIds = new Set<Id>();
        for (UserAllocationWrapper w : allocations) {
            if (w != null && w.userId != null) {
                userIds.add(w.userId);
            }
        }

        if (userIds.isEmpty()) {
            throw new AuraHandledException('No users provided in allocations');
        }

        Map<Id, User> userMap = new Map<Id, User>([
            SELECT Id, Rate_Per_Hour__c, Role__c
            FROM User
            WHERE Id IN :userIds
        ]);

        // Existing project team members so we can UPDATE them instead of skipping
        Map<Id, Project_Team_Member__c> existingByUser = new Map<Id, Project_Team_Member__c>();
        for (Project_Team_Member__c rec : [
            SELECT Id, Assigned_To__c, Rate_Per_Hour__c, Role__c, Allocation__c, Is_Active__c
            FROM Project_Team_Member__c
            WHERE Project__c = :projectId
        ]) {
            existingByUser.put(rec.Assigned_To__c, rec);
        }

        List<Project_Team_Member__c> toInsert = new List<Project_Team_Member__c>();
        List<Project_Team_Member__c> toUpdate = new List<Project_Team_Member__c>();

        for (UserAllocationWrapper w : allocations) {
            if (w == null || w.userId == null) {
                continue;
            }

            User u = userMap.get(w.userId);
            Project_Team_Member__c ptm;

            if (existingByUser.containsKey(w.userId)) {
                // UPDATE existing project team member
                ptm = existingByUser.get(w.userId);
            } else {
                // INSERT new project team member
                ptm = new Project_Team_Member__c();
                ptm.Project__c = projectId;
                ptm.Assigned_To__c = w.userId;
                toInsert.add(ptm);
            }

            // Apply rate (explicit value wins, otherwise default from User)
            if (w.ratePerHour != null) {
                ptm.Rate_Per_Hour__c = w.ratePerHour;
            } else if (u != null) {
                ptm.Rate_Per_Hour__c = u.Rate_Per_Hour__c;
            }

            // Apply role (explicit value wins, otherwise default from User)
            if (String.isNotBlank(w.role)) {
                ptm.Role__c = w.role;
            } else if (u != null) {
                ptm.Role__c = u.Role__c;
            }

            // Allocation and Active flag always come from the wrapper
            ptm.Allocation__c = w.allocationPercent;
            ptm.Is_Active__c = (w.isActive == null) ? true : w.isActive;

            if (ptm.Id != null && !toUpdate.contains(ptm)) {
                toUpdate.add(ptm);
            }
        }

        if (!toInsert.isEmpty()) {
            insert toInsert;
        }
        if (!toUpdate.isEmpty()) {
            update toUpdate;
        }

        String message = '';
        if(!toInsert.isEmpty() && !toUpdate.isEmpty()){
            message = 'Records Created and Updated Successfully';
            return message;
        }
        if (!toInsert.isEmpty()) {
            message  = 'Records Created Successfully';
            return message;
        }
        if (!toUpdate.isEmpty()) {
            message  = 'Records Updated Successfully';
            return message;
        }
        if (message == '') message = 'No users selected';

        return message;
    }
    
    /* ---------- ASSIGN PROJECT TEAM MEMBERS ---------- */
    @AuraEnabled
    public static String assignProjectMembers(Id projectId, List<Id> userIds) {
        if (projectId == null || userIds == null || userIds.isEmpty()) {
            throw new AuraHandledException('Project Id or Users are missing');
        }
        // Fetch existing project team users
        Set<Id> existingUsers = new Set<Id>();
        for (Project_Team_Member__c rec : [SELECT Assigned_To__c FROM Project_Team_Member__c WHERE Project__c = :projectId]) {
            existingUsers.add(rec.Assigned_To__c);
        }
        List<Project_Team_Member__c> toInsert = new List<Project_Team_Member__c>();
        Integer duplicateCount = 0;
        for (Id userId : userIds) {
            if (!existingUsers.contains(userId)) {
                toInsert.add(new Project_Team_Member__c(Project__c = projectId, Assigned_To__c = userId));
            } else {
                duplicateCount++;
            }
        }
        if (!toInsert.isEmpty()) {
            insert toInsert;
        }
        // Response message
        String message = '';
        if (!toInsert.isEmpty()) {
            message += toInsert.size() + ' member(s) added';
        }
        if (duplicateCount > 0) {
            if (message != '') message += ', ';
            message += duplicateCount + ' duplicate(s) skipped';
        }
        if (message == '') message = 'No users selected';
        return message;
    }
    
    /* ---------- CONTEXT RESOLUTION ---------- */
    @AuraEnabled
    public static Map<String, String> resolveContext(Id recordId) {
        Map<String, String> result = new Map<String, String>{
            'projectId' => null,
                'milestoneId' => null,
                'taskListId' => null
                };
                    
                    if (recordId == null) {
                        return result;
                    }
        
        String objectName = recordId.getSObjectType().getDescribe().getName();
        
        if (objectName == 'Project__c') {
            result.put('projectId', recordId);
        } else if (objectName == 'Milestone__c') {
            Milestone__c milestone = [
                SELECT Id, Project__c 
                FROM Milestone__c 
                WHERE Id = :recordId 
                LIMIT 1
            ];
            result.put('projectId', milestone.Project__c);
            result.put('milestoneId', milestone.Id);
        } else if (objectName == 'Task_List__c') {
            Task_List__c taskList = [
                SELECT Id, Milestone__c, Milestone__r.Project__c 
                FROM Task_List__c 
                WHERE Id = :recordId
                LIMIT 1
            ];
            result.put('projectId', taskList.Milestone__r.Project__c);
            result.put('milestoneId', taskList.Milestone__c);
            result.put('taskListId', taskList.Id);
        }
        
        return result;
    }
    
    /* ---------- DEPENDENT PICKLISTS ---------- */
    @AuraEnabled(cacheable=true)
    public static List<Milestone__c> getMilestonesByProject(Id projectId) {
        if (projectId == null) {
            return new List<Milestone__c>();
        }
        return [
            SELECT Id, Name 
            FROM Milestone__c 
            WHERE Project__c = :projectId 
            ORDER BY Name
        ];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Task_List__c> getTaskListsByMilestone(Id milestoneId) {
        if (milestoneId == null) {
            return new List<Task_List__c>();
        }
        return [
            SELECT Id, Name 
            FROM Task_List__c 
            WHERE Milestone__c = :milestoneId 
            ORDER BY Name
        ];
    }
    
    @AuraEnabled
    public static Integer saveTasksWithOwners(String tasksData) {
        
        if (String.isBlank(tasksData)) {
            throw new AuraHandledException('No task data provided');
        }
        
        List<TaskWrapper> taskWrappers;
        try {
            taskWrappers = (List<TaskWrapper>) JSON.deserialize(
                tasksData,
                List<TaskWrapper>.class
            );
        } catch (Exception e) {
            throw new AuraHandledException('Invalid task data format: ' + e.getMessage());
        }
        
        if (taskWrappers.isEmpty()) {
            throw new AuraHandledException('No tasks to save');
        }
        
        List<Tasks__c> tasksToInsert = new List<Tasks__c>();
        List<Task_Owner__c> taskOwnersToInsert = new List<Task_Owner__c>();
        List<Resource_Allocation__c> resourceAllocationsToInsert = new List<Resource_Allocation__c>();
        List<ContentDocumentLink> contentLinksToInsert = new List<ContentDocumentLink>();
        
        /* ---------- CREATE TASKS ---------- */
        for (TaskWrapper wrapper : taskWrappers) {
            tasksToInsert.add(new Tasks__c(
                Name = wrapper.taskName,
                Priority__c = wrapper.priority,
                Associated_Project__c = wrapper.project,
                Milestone__c = wrapper.milestone,
                Task_List__c = wrapper.taskList,
                Billing_Type__c = wrapper.billingType,
                Start_Date__c = wrapper.startDate,
                End_Date__c = wrapper.endDate,
                Work_Hours__c = wrapper.workHours,
                Comment__c = wrapper.comments,
                Issue_Bug__c = wrapper.issueBug,
                Status__c = 'Assigned'
            ));
        }
        
        insert tasksToInsert;
        
        /* ---------- OWNERS, ALLOCATIONS, FILES ---------- */
        for (Integer i = 0; i < taskWrappers.size(); i++) {
            TaskWrapper wrapper = taskWrappers[i];
            Tasks__c insertedTask = tasksToInsert[i];
            
            /* ---- TASK OWNERS ---- */
            if (wrapper.teamMemberIds != null) {
                for (Id userId : wrapper.teamMemberIds) {
                    taskOwnersToInsert.add(new Task_Owner__c(
                        Tasks__c = insertedTask.Id,
                        User__c = userId
                    ));
                }
            }
            
            /* ---- RESOURCE ALLOCATION ---- */
            if (wrapper.allocationData != null && !wrapper.allocationData.isEmpty()) {
                // FLEXIBLE MODE
                for (AllocationWrapper alloc : wrapper.allocationData) {
                    if (alloc.hours != null && alloc.hours > 0) {
                        resourceAllocationsToInsert.add(new Resource_Allocation__c(
                            Date__c = alloc.allocationDate,
                            Allocated_Hours__c = alloc.hours,
                            Task__c = insertedTask.Id,
                            Resource__c = alloc.userId,
                            Project__c = wrapper.project
                        ));
                    }
                }
            } else {
                // STANDARD MODE
                if (wrapper.startDate != null && wrapper.endDate != null &&
                    wrapper.teamMemberIds != null) {
                        
                        List<Date> weekdays =
                            getWeekdaysBetween(wrapper.startDate, wrapper.endDate);
                        
                        for (Id userId : wrapper.teamMemberIds) {
                            for (Date d : weekdays) {
                                resourceAllocationsToInsert.add(new Resource_Allocation__c(
                                    Date__c = d,
                                    Allocated_Hours__c = 8,
                                    Task__c = insertedTask.Id,
                                    Resource__c = userId,
                                    Project__c = wrapper.project
                                ));
                            }
                        }
                    }
            }
            
            /* ---- FILE LINKING (THIS IS WHAT YOU ASKED TO ADD) ---- */
            if (wrapper.files != null && !wrapper.files.isEmpty()) {
                for (FileWrapper file : wrapper.files) {
                    if (String.isNotBlank(file.docId)) {
                        contentLinksToInsert.add(new ContentDocumentLink(
                            LinkedEntityId = insertedTask.Id,
                            ContentDocumentId = file.docId,
                            ShareType = 'V',
                            Visibility = 'AllUsers'
                        ));
                    }
                }
            }
        }
        
        if (!taskOwnersToInsert.isEmpty()) {
            insert taskOwnersToInsert;
        }
        
        if (!resourceAllocationsToInsert.isEmpty()) {
            insert resourceAllocationsToInsert;
        }
        
        if (!contentLinksToInsert.isEmpty()) {
            insert contentLinksToInsert;
        }
        
        return tasksToInsert.size();
    }

    
    /* ---------- WEEKDAYS ---------- */
    private static List<Date> getWeekdaysBetween(Date startDate, Date endDate) {
        List<Date> weekdays = new List<Date>();
        Date currentDate = startDate;
        
        while (currentDate <= endDate) {
            Datetime dt = Datetime.newInstance(currentDate, Time.newInstance(0, 0, 0, 0));
            String dayOfWeek = dt.format('E'); // Returns Mon, Tue, Wed, etc.
            
            // Exclude Saturday and Sunday
            if (dayOfWeek != 'Sat' && dayOfWeek != 'Sun') {
                weekdays.add(currentDate);
            }
            
            currentDate = currentDate.addDays(1);
        }
        
        return weekdays;
    }

    // Added From WorkSpaceController
    @AuraEnabled(cacheable=true)
    public static Boolean isInternalUser() {
        try {
            // Check if user is in a Community/Experience Site
            // Network.getNetworkId() returns null for internal users
            // Returns a NetworkId for Experience Site/Community users
            Id networkId = Network.getNetworkId();
            
            // If networkId is null, user is an internal Salesforce user
            return networkId == null;
            
        } catch (Exception e) {
            System.debug('Error checking user type: ' + e.getMessage());
            // Default to false (treat as site user) if error occurs
            return false;
        }
    }
    
    public class FileWrapper {
        @AuraEnabled public String fileName { get; set; }
        @AuraEnabled public String docId { get; set; }
        @AuraEnabled public String versionId { get; set; }
        @AuraEnabled public String bodyId { get; set; }
        @AuraEnabled public String fileType { get; set; }
    }

    
    /* ---------- WRAPPERS ---------- */
    public class TaskWrapper {
        @AuraEnabled public String taskName { get; set; }
        @AuraEnabled public String priority { get; set; }
        @AuraEnabled public Id project { get; set; }
        @AuraEnabled public Id milestone { get; set; }
        @AuraEnabled public Id taskList { get; set; }
        @AuraEnabled public String billingType { get; set; }
        @AuraEnabled public Date startDate { get; set; }
        @AuraEnabled public Date endDate { get; set; }
        @AuraEnabled public Decimal workHours { get; set; }
        @AuraEnabled public String comments { get; set; }
        @AuraEnabled public Id issueBug { get; set; }
        @AuraEnabled public List<Id> teamMemberIds { get; set; }
        @AuraEnabled public List<AllocationWrapper> allocationData { get; set; }
        @AuraEnabled public List<FileWrapper> files { get; set; }  // ← CHANGED TO FileWrapper
    }
    
    public class AllocationWrapper {
        @AuraEnabled public Id userId { get; set; }
        @AuraEnabled public Date allocationDate { get; set; }
        @AuraEnabled public Decimal hours { get; set; }
    }

    public class UserDetailsWrapper {
        @AuraEnabled public Id userId { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Decimal ratePerHour { get; set; }
        @AuraEnabled public String role { get; set; }
        @AuraEnabled public Decimal allocationPercent { get; set; }
        @AuraEnabled public Boolean isActive { get; set; }
    }

    public class UserAllocationWrapper {
        @AuraEnabled public Id userId { get; set; }
        @AuraEnabled public Decimal allocationPercent { get; set; }
        @AuraEnabled public Decimal ratePerHour { get; set; }
        @AuraEnabled public String role { get; set; }
        @AuraEnabled public Boolean isActive { get; set; }
    }

    public class PicklistOption {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String value { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getUserRoleOptions() {
        List<PicklistOption> options = new List<PicklistOption>();

        Schema.DescribeFieldResult describe = User.Role__c.getDescribe();
        for (Schema.PicklistEntry entry : describe.getPicklistValues()) {
            PicklistOption opt = new PicklistOption();
            opt.label = entry.getLabel();
            opt.value = entry.getValue();
            options.add(opt);
        }

        return options;
    }
}