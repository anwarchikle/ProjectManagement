public with sharing class EditTaskController {
    
    /* ---------- GET TASK DETAILS WITH TEAM MEMBERS AND ALLOCATIONS ---------- */
@AuraEnabled
public static TaskDetailsWrapper getTaskDetails(Id taskId) {
    if (taskId == null) {
        throw new AuraHandledException('Task ID is required');
    }
    
    TaskDetailsWrapper wrapper = new TaskDetailsWrapper();
    
    // Fetch Task Record
    try {
        wrapper.taskRecord = [
            SELECT Id, Name, Priority__c, Associated_Project__c, Milestone__c, 
                   Task_List__c, Billing_Type__c, Start_Date__c, End_Date__c, 
                   Work_Hours__c, Comment__c, Issue_Bug__c, Change_Request__c
            FROM Tasks__c 
            WHERE Id = :taskId 
            LIMIT 1
        ];
    } catch (Exception e) {
        throw new AuraHandledException('Task not found: ' + e.getMessage());
    }
    
    // Fetch Team Members (Task Owners)
    List<Task_Owner__c> taskOwners = [
        SELECT Id, User__c, User__r.Name, User__r.Email
        FROM Task_Owner__c 
        WHERE Tasks__c = :taskId
    ];
    
    wrapper.teamMembers = new List<TeamMemberWrapper>();
    for (Task_Owner__c owner : taskOwners) {
        TeamMemberWrapper member = new TeamMemberWrapper();
        member.Id = owner.User__c;
        member.Name = owner.User__r.Name;
        member.Email = owner.User__r.Email;
        wrapper.teamMembers.add(member);
    }
    
    // Fetch Resource Allocations
    wrapper.allocations = [
        SELECT Id, Resource__c, Date__c, Allocated_Hours__c
        FROM Resource_Allocation__c
        WHERE Task__c = :taskId
        ORDER BY Date__c ASC
    ];
    
    // *** ADD THIS: Fetch Attached Files ***
    wrapper.attachedFiles = new List<FileWrapper>();
    List<ContentDocumentLink> cdLinks = [
        SELECT ContentDocumentId, ContentDocument.Title, 
               ContentDocument.FileType, ContentDocument.ContentSize,
               ContentDocument.LatestPublishedVersionId
        FROM ContentDocumentLink 
        WHERE LinkedEntityId = :taskId
    ];
    
    for (ContentDocumentLink cdl : cdLinks) {
        FileWrapper fileWrap = new FileWrapper();
        fileWrap.documentId = cdl.ContentDocumentId;
        fileWrap.fileName = cdl.ContentDocument.Title;
        fileWrap.fileType = cdl.ContentDocument.FileType;
        fileWrap.fileSize = cdl.ContentDocument.ContentSize;
        fileWrap.versionId = cdl.ContentDocument.LatestPublishedVersionId;
        wrapper.attachedFiles.add(fileWrap);
    }
    
    return wrapper;
}
    
    /* ---------- UPDATE TASK WITH OWNERS AND RESOURCE ALLOCATION ---------- */
@AuraEnabled
public static String updateTaskWithOwners(String taskDataJson) {
    if (String.isBlank(taskDataJson)) {
        throw new AuraHandledException('No task data provided');
    }
    
    TaskUpdateWrapper taskData;
    try {
        taskData = (TaskUpdateWrapper) JSON.deserialize(taskDataJson, TaskUpdateWrapper.class);
    } catch (Exception e) {
        throw new AuraHandledException('Invalid task data format: ' + e.getMessage());
    }
    
    if (taskData.taskId == null) {
        throw new AuraHandledException('Task ID is required');
    }
    
    try {
        // Update Task Record
        Tasks__c taskToUpdate = new Tasks__c(
            Id = taskData.taskId,
            Name = taskData.taskName,
            Priority__c = taskData.priority,
            Associated_Project__c = taskData.project,
            Milestone__c = taskData.milestone,
            Task_List__c = taskData.taskList,
            Billing_Type__c = taskData.billingType,
            Start_Date__c = taskData.startDate,
            End_Date__c = taskData.endDate,
            Work_Hours__c = taskData.workHours,
            Comment__c = taskData.comments,
            Issue_Bug__c = taskData.issueBug,
            Change_Request__c = taskData.changeRequest
        );
        update taskToUpdate;
        
        // Handle Task Owners and Resource Allocations
        handleTaskOwnersAndAllocations(taskData);
        
        // REMOVE THIS LINE: handleFileLinks(taskData);
        
        return 'Task updated successfully';
        
    } catch (Exception e) {
        System.debug('*** Error updating task: ' + e.getMessage());
        System.debug('*** Stack Trace: ' + e.getStackTraceString());
        throw new AuraHandledException('An error occurred while updating task: ' + e.getMessage());
    }
}

/* ---------- HANDLE FILE LINKS ---------- */
private static void handleFileLinks(TaskUpdateWrapper taskData) {
    if (taskData.files == null || taskData.files.isEmpty()) {
        return;
    }
    
    List<ContentDocumentLink> linksToInsert = new List<ContentDocumentLink>();
    
    // Get existing file links
    Set<Id> existingDocIds = new Set<Id>();
    for (ContentDocumentLink cdl : [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :taskData.taskId]) {
        existingDocIds.add(cdl.ContentDocumentId);
    }
    
    // Add new file links (skip duplicates)
    for (FileWrapper file : taskData.files) {
        if (String.isNotBlank(file.documentId) && !existingDocIds.contains(file.documentId)) {
            linksToInsert.add(new ContentDocumentLink(
                LinkedEntityId = taskData.taskId,
                ContentDocumentId = file.documentId,
                ShareType = 'V',
                Visibility = 'AllUsers'
            ));
        }
    }
    
    if (!linksToInsert.isEmpty()) {
        insert linksToInsert;
    }
}
    
    /* ---------- HANDLE TASK OWNERS AND ALLOCATIONS (NO NESTED LOOPS) ---------- */
    private static void handleTaskOwnersAndAllocations(TaskUpdateWrapper taskData) {
        
        // Get existing Task Owners
        Map<Id, Task_Owner__c> existingOwnersMap = new Map<Id, Task_Owner__c>();
        for (Task_Owner__c owner : [SELECT Id, User__c, Is_Active__c FROM Task_Owner__c WHERE Tasks__c = :taskData.taskId]) {
            existingOwnersMap.put(owner.User__c, owner);
        }
        
        // Get new Team Member IDs as Set for quick lookup
        Set<Id> newTeamMemberIds = new Set<Id>();
        if (taskData.teamMemberIds != null && !taskData.teamMemberIds.isEmpty()) {
            newTeamMemberIds.addAll(taskData.teamMemberIds);
        }
        
        // Determine which owners to keep, add, or remove
        Set<Id> ownersToKeep = new Set<Id>();
        List<Task_Owner__c> ownersToInsert = new List<Task_Owner__c>();
        List<Task_Owner__c> ownersToDeactivate = new List<Task_Owner__c>();
        List<Task_Owner__c> ownersToDelete = new List<Task_Owner__c>();
        
        // Check existing owners
        for (Id userId : existingOwnersMap.keySet()) {
            if (newTeamMemberIds.contains(userId)) {
                // Keep this owner
                ownersToKeep.add(userId);
            } else {
                // This owner needs to be removed
                Task_Owner__c ownerToRemove = existingOwnersMap.get(userId);
                
                // First deactivate, then delete
                if (ownerToRemove.Is_Active__c == true) {
                    ownerToRemove.Is_Active__c = false;
                    ownersToDeactivate.add(ownerToRemove);
                }
                ownersToDelete.add(ownerToRemove);
            }
        }
        
        // Check for new owners to add
        for (Id userId : newTeamMemberIds) {
            if (!existingOwnersMap.containsKey(userId)) {
                // New owner to add
                ownersToInsert.add(new Task_Owner__c(
                    Tasks__c = taskData.taskId,
                    User__c = userId,
                    Is_Active__c = true
                ));
            }
        }
        
        // Step 1: Deactivate owners that need to be deleted (to pass validation)
        if (!ownersToDeactivate.isEmpty()) {
            update ownersToDeactivate;
        }
        
        // Step 2: Delete Resource Allocations for removed owners (BEFORE deleting Task Owners)
        if (!ownersToDelete.isEmpty()) {
            Set<Id> userIdsToRemove = new Set<Id>();
            for (Task_Owner__c owner : ownersToDelete) {
                userIdsToRemove.add(owner.User__c);
            }
            
            List<Resource_Allocation__c> allocationsToDelete = [
                SELECT Id 
                FROM Resource_Allocation__c 
                WHERE Task__c = :taskData.taskId 
                AND Resource__c IN :userIdsToRemove
            ];
            
            if (!allocationsToDelete.isEmpty()) {
                delete allocationsToDelete;
            }
        }
        
        // Step 3: Delete deactivated Task Owners
        if (!ownersToDelete.isEmpty()) {
            delete ownersToDelete;
        }
        
        // Step 4: Insert new Task Owners
        if (!ownersToInsert.isEmpty()) {
            insert ownersToInsert;
        }
        
        // Step 5: Handle Resource Allocations for all current team members
        handleResourceAllocations(taskData, newTeamMemberIds);
    }
    
    /* ---------- HANDLE RESOURCE ALLOCATIONS (NO NESTED LOOPS) ---------- */
    private static void handleResourceAllocations(TaskUpdateWrapper taskData, Set<Id> currentTeamMemberIds) {
        
        // Get existing allocations for this task
        Map<String, Resource_Allocation__c> existingAllocationsMap = new Map<String, Resource_Allocation__c>();
        for (Resource_Allocation__c alloc : [
            SELECT Id, Resource__c, Date__c, Allocated_Hours__c 
            FROM Resource_Allocation__c 
            WHERE Task__c = :taskData.taskId
        ]) {
            // Create unique key: userId_date
            String key = String.valueOf(alloc.Resource__c) + '_' + String.valueOf(alloc.Date__c);
            existingAllocationsMap.put(key, alloc);
        }
        
        List<Resource_Allocation__c> allocationsToInsert = new List<Resource_Allocation__c>();
        List<Resource_Allocation__c> allocationsToUpdate = new List<Resource_Allocation__c>();
        Set<String> processedKeys = new Set<String>();
        
        if (taskData.allocationData != null && !taskData.allocationData.isEmpty()) {
            // FLEXIBLE MODE - Use provided allocation data
            System.debug('*** FLEXIBLE MODE - Processing ' + taskData.allocationData.size() + ' allocations');
            
            for (AllocationWrapper alloc : taskData.allocationData) {
                if (alloc.hours != null && alloc.hours > 0) {
                    String key = String.valueOf(alloc.userId) + '_' + String.valueOf(alloc.allocationDate);
                    processedKeys.add(key);
                    
                    if (existingAllocationsMap.containsKey(key)) {
                        // Update existing allocation
                        Resource_Allocation__c existingAlloc = existingAllocationsMap.get(key);
                        if (existingAlloc.Allocated_Hours__c != alloc.hours) {
                            existingAlloc.Allocated_Hours__c = alloc.hours;
                            allocationsToUpdate.add(existingAlloc);
                        }
                    } else {
                        // Insert new allocation
                        allocationsToInsert.add(new Resource_Allocation__c(
                            Date__c = alloc.allocationDate,
                            Allocated_Hours__c = alloc.hours,
                            Task__c = taskData.taskId,
                            Resource__c = alloc.userId,
                            Project__c = taskData.project
                        ));
                    }
                }
            }
            
        } else {
            // STANDARD MODE - Create 8-hour weekday allocations
            System.debug('*** STANDARD MODE - Creating default allocations');
            
            if (taskData.startDate != null && taskData.endDate != null && !currentTeamMemberIds.isEmpty()) {
                List<Date> weekdays = getWeekdaysBetween(taskData.startDate, taskData.endDate);
                
                for (Id userId : currentTeamMemberIds) {
                    for (Date workDate : weekdays) {
                        String key = String.valueOf(userId) + '_' + String.valueOf(workDate);
                        processedKeys.add(key);
                        
                        if (existingAllocationsMap.containsKey(key)) {
                            // Update existing allocation to 8 hours
                            Resource_Allocation__c existingAlloc = existingAllocationsMap.get(key);
                            if (existingAlloc.Allocated_Hours__c != 8.0) {
                                existingAlloc.Allocated_Hours__c = 8.0;
                                allocationsToUpdate.add(existingAlloc);
                            }
                        } else {
                            // Insert new allocation
                            allocationsToInsert.add(new Resource_Allocation__c(
                                Date__c = workDate,
                                Allocated_Hours__c = 8.0,
                                Task__c = taskData.taskId,
                                Resource__c = userId,
                                Project__c = taskData.project
                            ));
                        }
                    }
                }
            }
        }
        
        // Delete allocations that are no longer needed
        List<Resource_Allocation__c> allocationsToDelete = new List<Resource_Allocation__c>();
        for (String key : existingAllocationsMap.keySet()) {
            if (!processedKeys.contains(key)) {
                allocationsToDelete.add(existingAllocationsMap.get(key));
            }
        }
        
        // Perform DML operations (NO NESTED LOOPS - All in bulk)
        if (!allocationsToUpdate.isEmpty()) {
            update allocationsToUpdate;
            System.debug('*** Updated ' + allocationsToUpdate.size() + ' allocations');
        }
        
        if (!allocationsToInsert.isEmpty()) {
            insert allocationsToInsert;
            System.debug('*** Inserted ' + allocationsToInsert.size() + ' allocations');
        }
        
        if (!allocationsToDelete.isEmpty()) {
            delete allocationsToDelete;
            System.debug('*** Deleted ' + allocationsToDelete.size() + ' allocations');
        }
    }
    
    /* ---------- HELPER METHOD: GET WEEKDAYS ---------- */
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

    /* ---------- UPLOAD FILES ---------- */
@AuraEnabled
public static String uploadFile(String fileName, String base64Data, String contentType, Id taskId) {
    try {
        // Create ContentVersion
        ContentVersion cv = new ContentVersion();
        cv.Title = fileName;
        cv.PathOnClient = fileName;
        cv.VersionData = EncodingUtil.base64Decode(base64Data);
        cv.FirstPublishLocationId = taskId;
        cv.IsMajorVersion = true;
        
        insert cv;
        
        // Get the ContentDocumentId
        ContentVersion insertedCV = [
            SELECT ContentDocumentId 
            FROM ContentVersion 
            WHERE Id = :cv.Id 
            LIMIT 1
        ];
        
        return insertedCV.ContentDocumentId;
        
    } catch (Exception e) {
        throw new AuraHandledException('Error uploading file: ' + e.getMessage());
    }
}
    
    /* ---------- WRAPPER CLASSES ---------- */
public class TaskDetailsWrapper {
    @AuraEnabled public Tasks__c taskRecord { get; set; }
    @AuraEnabled public List<TeamMemberWrapper> teamMembers { get; set; }
    @AuraEnabled public List<Resource_Allocation__c> allocations { get; set; }
    @AuraEnabled public List<FileWrapper> attachedFiles { get; set; } // ADD THIS
}

public class TeamMemberWrapper {
    @AuraEnabled public Id Id { get; set; }
    @AuraEnabled public String Name { get; set; }
    @AuraEnabled public String Email { get; set; }
}

public class FileWrapper {
    @AuraEnabled public String documentId { get; set; }
    @AuraEnabled public String fileName { get; set; }
    @AuraEnabled public String fileType { get; set; }
    @AuraEnabled public Long fileSize { get; set; }
    @AuraEnabled public String versionId { get; set; }
}

public class TaskUpdateWrapper {
    @AuraEnabled public Id taskId { get; set; }
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
    @AuraEnabled public Id changeRequest { get; set; }
    @AuraEnabled public List<Id> teamMemberIds { get; set; }
    @AuraEnabled public List<AllocationWrapper> allocationData { get; set; }
    @AuraEnabled public List<FileWrapper> files { get; set; } // ADD THIS
}

public class AllocationWrapper {
    @AuraEnabled public Id userId { get; set; }
    @AuraEnabled public Date allocationDate { get; set; }
    @AuraEnabled public Decimal hours { get; set; }
}
}