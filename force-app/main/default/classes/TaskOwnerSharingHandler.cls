public without sharing class TaskOwnerSharingHandler {

    private static final String ACCESS_LEVEL = 'Read';  // or 'Edit'
    private static final String ROW_CAUSE    = 'Manual';

    // CREATE (Insert/Undelete) 
    public static void createSharing(List<Task_Owner__c> owners) {
        try {
            if (owners == null || owners.isEmpty()) return;

            // Build Task -> Users map (ACTIVE ONLY)
            Map<Id, Set<Id>> taskToUsers = new Map<Id, Set<Id>>();
            Set<Id> taskIds = new Set<Id>();

            for (Task_Owner__c owner : owners) {
                if (owner.Tasks__c == null || owner.User__c == null) continue;
                if (owner.Is_Active__c != true) continue; // Only active rows create shares

                taskIds.add(owner.Tasks__c);

                if (!taskToUsers.containsKey(owner.Tasks__c)) {
                    taskToUsers.put(owner.Tasks__c, new Set<Id>());
                }
                taskToUsers.get(owner.Tasks__c).add(owner.User__c);
            }
            if (taskIds.isEmpty()) return;

            // Existing shares to avoid duplicates
            Map<Id, Map<Id, Tasks__Share>> existing = new Map<Id, Map<Id, Tasks__Share>>();
            for (Tasks__Share s : [
                SELECT Id, ParentId, UserOrGroupId, AccessLevel, RowCause
                FROM Tasks__Share
                WHERE ParentId IN :taskIds
                AND RowCause = :ROW_CAUSE
            ]) {
                if (!existing.containsKey(s.ParentId)) {
                    existing.put(s.ParentId, new Map<Id, Tasks__Share>());
                }
                existing.get(s.ParentId).put(s.UserOrGroupId, s);
            }

            List<Tasks__Share> toInsert = new List<Tasks__Share>();

            // Single-pass over owners (no nested loops), in-batch dedupe
            Set<String> planned = new Set<String>();
            for (Task_Owner__c o : owners) {
                if (o.Tasks__c == null || o.User__c == null) continue;
                if (o.Is_Active__c != true) continue; // Only active rows create shares

                String k = String.valueOf(o.Tasks__c) + '|' + String.valueOf(o.User__c);
                if (planned.contains(k)) continue;  // avoid duplicate work
                planned.add(k);

                Tasks__Share prev = (existing.containsKey(o.Tasks__c))
                    ? existing.get(o.Tasks__c).get(o.User__c)
                    : null;

                if (prev == null) {
                    Tasks__Share sh = new Tasks__Share();
                    sh.ParentId      = o.Tasks__c;
                    sh.UserOrGroupId = o.User__c;
                    sh.AccessLevel   = ACCESS_LEVEL;
                    sh.RowCause      = ROW_CAUSE;
                    toInsert.add(sh);
                }
            }

            if (!toInsert.isEmpty()) Database.insert(toInsert, /*allOrNone*/ false);

        } catch (Exception e) {
            System.debug('createSharing EXCEPTION: ' + e.getMessage() + ' @line ' + e.getLineNumber());
        }
    }

    // UPDATE 
    public static void updateSharing(List<Task_Owner__c> newList, Map<Id, Task_Owner__c> oldMap) {
        try {
            if (newList == null || newList.isEmpty() || oldMap == null) return;

            List<Task_Owner__c> needCreate = new List<Task_Owner__c>();
            List<Task_Owner__c> needDelete = new List<Task_Owner__c>();

            for (Task_Owner__c n : newList) {
                Task_Owner__c o = oldMap.get(n.Id);
                if (o == null) continue;

                Boolean becameActive    = (n.Is_Active__c == true) && (o.Is_Active__c != true);
                Boolean becameInactive  = (o.Is_Active__c == true) && (n.Is_Active__c != true);

                Boolean taskChanged     = (o.Tasks__c != n.Tasks__c);
                Boolean userChanged     = (o.User__c  != n.User__c);
                Boolean pairChanged     = taskChanged || userChanged;

                // Remove old share if: went inactive OR pair changed while old was active
                if (becameInactive || (pairChanged && o.Is_Active__c == true)) {
                    if (o.Tasks__c != null && o.User__c != null) {
                        needDelete.add(o);
                    }
                }

                // Create new share if: became active OR pair changed and new row is active
                if (becameActive || (pairChanged && n.Is_Active__c == true)) {
                    if (n.Tasks__c != null && n.User__c != null) {
                        needCreate.add(n);
                    }
                }
            }

            if (!needDelete.isEmpty()) removeSharing(needDelete);
            if (!needCreate.isEmpty()) createSharing(needCreate);

        } catch (Exception e) {
            System.debug('updateSharing EXCEPTION: ' + e.getMessage() + ' @line ' + e.getLineNumber());
        }
    }

    //  DELETE 
    public static void removeSharing(List<Task_Owner__c> owners) {
        if (owners == null || owners.isEmpty()) return;

        Set<Id> taskIds = new Set<Id>();
        Set<Id> userIds = new Set<Id>();
        Set<String> seen = new Set<String>();

        for (Task_Owner__c o : owners) {
            if (o.Tasks__c == null && o.User__c == null) continue;
            if (o.Tasks__c == null || o.User__c == null) continue;
            if (o.Is_Active__c != true) continue; // Unshare only if it was active at delete time

            String k = String.valueOf(o.Tasks__c) + '|' + String.valueOf(o.User__c);
            if (seen.contains(k)) continue;
            seen.add(k);

            taskIds.add(o.Tasks__c);
            userIds.add(o.User__c);
        }
        if (taskIds.isEmpty() || userIds.isEmpty()) return;

        List<Tasks__Share> toDelete = [
            SELECT Id
            FROM Tasks__Share
            WHERE ParentId IN :taskIds
              AND UserOrGroupId IN :userIds
              AND RowCause = :ROW_CAUSE
        ];
        if (!toDelete.isEmpty()) Database.delete(toDelete, /*allOrNone*/ false);
    }

    // DYNAMIC CHILD SHARING (CASCADE)  

    // INSERT/UNDELETE path
    public static void cascadeChildSharing(List<Task_Owner__c> owners) {
        if (owners == null || owners.isEmpty()) return;

        Map<Id, Set<Id>> taskToUsers = new Map<Id, Set<Id>>();
        Set<Id> taskIds = new Set<Id>();

        for (Task_Owner__c o : owners) {
            if (o.Tasks__c == null || o.User__c == null) continue;
            if (o.Is_Active__c != true) continue; // Only cascade for active rows
            taskIds.add(o.Tasks__c);
            if (!taskToUsers.containsKey(o.Tasks__c)) {
                taskToUsers.put(o.Tasks__c, new Set<Id>());
            }
            taskToUsers.get(o.Tasks__c).add(o.User__c);
        }
        if (taskIds.isEmpty()) return;

        shareChildrenFor(taskToUsers);
    }

    // UPDATE path
    public static void cascadeChildSharingOnUpdate(List<Task_Owner__c> newList, Map<Id, Task_Owner__c> oldMap) {
        if (newList == null || newList.isEmpty() || oldMap == null) return;

        Map<Id, Set<Id>> createMap = new Map<Id, Set<Id>>();
        Map<Id, Set<Id>> removeMap = new Map<Id, Set<Id>>();

        for (Task_Owner__c n : newList) {
            Task_Owner__c o = oldMap.get(n.Id);
            if (o == null) continue;

            Boolean becameActive    = (n.Is_Active__c == true) && (o.Is_Active__c != true);
            Boolean becameInactive  = (o.Is_Active__c == true) && (n.Is_Active__c != true);

            Boolean taskChanged     = (o.Tasks__c != n.Tasks__c);
            Boolean userChanged     = (o.User__c  != n.User__c);
            Boolean pairChanged     = taskChanged || userChanged;

            // Remove old (only if it was active)
            if (becameInactive || (pairChanged && o.Is_Active__c == true)) {
                if (o.Tasks__c != null && o.User__c != null) {
                    if (!removeMap.containsKey(o.Tasks__c)) {
                        removeMap.put(o.Tasks__c, new Set<Id>());
                    }
                    removeMap.get(o.Tasks__c).add(o.User__c);
                }
            }
            // Create new (only if it is active)
            if (becameActive || (pairChanged && n.Is_Active__c == true)) {
                if (n.Tasks__c != null && n.User__c != null) {
                    if (!createMap.containsKey(n.Tasks__c)) {
                        createMap.put(n.Tasks__c, new Set<Id>());
                    }
                    createMap.get(n.Tasks__c).add(n.User__c);
                }
            }
        }

        if (!removeMap.isEmpty()) unshareChildrenFor(removeMap);
        if (!createMap.isEmpty()) shareChildrenFor(createMap);
    }

    // DELETE path
    public static void removeChildSharing(List<Task_Owner__c> owners) {
        if (owners == null || owners.isEmpty()) return;

        Map<Id, Set<Id>> taskToUsers = new Map<Id, Set<Id>>();
        for (Task_Owner__c o : owners) {
            if (o.Tasks__c == null || o.User__c == null) continue;
            if (o.Is_Active__c != true) continue; // Only remove child shares if it was active
            if (!taskToUsers.containsKey(o.Tasks__c)) {
                taskToUsers.put(o.Tasks__c, new Set<Id>());
            }
            taskToUsers.get(o.Tasks__c).add(o.User__c);
        }
        if (taskToUsers.isEmpty()) return;

        unshareChildrenFor(taskToUsers);
    }

    // Core child-sharing engine 
    private static void shareChildrenFor(Map<Id, Set<Id>> taskToUsers) {

        List<Schema.ChildRelationship> rels =
            Schema.getGlobalDescribe().get('Tasks__c')
            .getDescribe().getChildRelationships();

        // child object -> (taskId -> childId list)
        Map<String, Map<Id, List<Id>>> objToTaskToChildIds = new Map<String, Map<Id, List<Id>>>();

        for (Schema.ChildRelationship cr : rels) {
            Schema.SObjectType childType = cr.getChildSObject();
            String childApi = childType.getDescribe().getName();

            // custom objects only
            if (!childApi.endsWith('__c')) continue;

            // only shareable children (lookup) have a __Share table
            String shareApi = childApi.replace('__c', '__Share');
            if (!Schema.getGlobalDescribe().containsKey(shareApi)) {
                // master-detail or standard without share -> inherits or unsupported
                continue;
            }

            // field on child that looks up to Tasks__c
            String lookupFieldApi = cr.getField().getDescribe().getName();

            // fetch child rows grouped by task
            Set<Id> allTaskIds = taskToUsers.keySet();
            String soql = 'SELECT Id,' + lookupFieldApi +
                          ' FROM ' + childApi +
                          ' WHERE ' + lookupFieldApi + ' IN :allTaskIds';

            List<SObject> childRows = Database.query(soql);

            Map<Id, List<Id>> taskToChild = new Map<Id, List<Id>>();
            for (SObject row : childRows) {
                Id tId = (Id) row.get(lookupFieldApi);
                if (!taskToChild.containsKey(tId)) {
                    taskToChild.put(tId, new List<Id>());
                }
                taskToChild.get(tId).add((Id) row.get('Id'));
            }

            if (!taskToChild.isEmpty()) {
                objToTaskToChildIds.put(childApi, taskToChild);
            }
        }

        if (objToTaskToChildIds.isEmpty()) return;

        // For each child object, build shares
        for (String childApi : objToTaskToChildIds.keySet()) {
            String shareApi = childApi.replace('__c', '__Share');

            // All target child Ids
            Set<Id> allChildIds = new Set<Id>();
            for (Id tId : objToTaskToChildIds.get(childApi).keySet()) {
                allChildIds.addAll(objToTaskToChildIds.get(childApi).get(tId));
            }
            if (allChildIds.isEmpty()) continue;

            // Existing shares to avoid duplicates
            Map<Id, Set<Id>> childToUsersExisting = new Map<Id, Set<Id>>();
            String qExisting = 'SELECT Id, ParentId, UserOrGroupId FROM ' + shareApi +
                               ' WHERE ParentId IN :allChildIds AND RowCause = :ROW_CAUSE';
            List<SObject> existingShares = Database.query(qExisting);
            for (SObject ex : existingShares) {
                Id p = (Id) ex.get('ParentId');
                Id u = (Id) ex.get('UserOrGroupId');
                if (!childToUsersExisting.containsKey(p)) {
                    childToUsersExisting.put(p, new Set<Id>());
                }
                childToUsersExisting.get(p).add(u);
            }

            List<SObject> toInsert = new List<SObject>();

            // Build new shares
            for (Id tId : objToTaskToChildIds.get(childApi).keySet()) {
                List<Id> childIds = objToTaskToChildIds.get(childApi).get(tId);
                Set<Id> users = taskToUsers.get(tId);
                if (users == null || users.isEmpty() || childIds == null || childIds.isEmpty()) continue;

                for (Id cId : childIds) {
                    for (Id uId : users) {
                        // Skip duplicates
                        if (childToUsersExisting.containsKey(cId) && childToUsersExisting.get(cId).contains(uId)) {
                            continue;
                        }
                        SObject sh = Schema.getGlobalDescribe().get(shareApi).newSObject();
                        sh.put('ParentId',      cId);
                        sh.put('UserOrGroupId', uId);
                        sh.put('AccessLevel',   ACCESS_LEVEL);
                        sh.put('RowCause',      ROW_CAUSE);
                        toInsert.add(sh);
                    }
                }
            }

            if (!toInsert.isEmpty()) Database.insert(toInsert, /*allOrNone*/ false);
        }
    }

    private static void unshareChildrenFor(Map<Id, Set<Id>> taskToUsers) {

        List<Schema.ChildRelationship> rels =
            Schema.getGlobalDescribe().get('Tasks__c')
            .getDescribe().getChildRelationships();

        for (Schema.ChildRelationship cr : rels) {
            String childApi = cr.getChildSObject().getDescribe().getName();
            if (!childApi.endsWith('__c')) continue;

            String shareApi = childApi.replace('__c', '__Share');
            if (!Schema.getGlobalDescribe().containsKey(shareApi)) {
                // master-detail/unsupported -> nothing to delete
                continue;
            }

            String lookupFieldApi = cr.getField().getDescribe().getName();

            // Gather child Ids by tasks
            Set<Id> allTaskIds = taskToUsers.keySet();
            String soql = 'SELECT Id FROM ' + childApi +
                          ' WHERE ' + lookupFieldApi + ' IN :allTaskIds';
            List<SObject> childRows = Database.query(soql);
            Set<Id> childIds = new Set<Id>();
            for (SObject r : childRows) childIds.add((Id) r.get('Id'));
            if (childIds.isEmpty()) continue;

            // Gather users
            Set<Id> userIds = new Set<Id>();
            for (Id tId : taskToUsers.keySet()) {
                userIds.addAll(taskToUsers.get(tId));
            }
            if (userIds.isEmpty()) continue;

            // Delete shares
            String q = 'SELECT Id FROM ' + shareApi +
                       ' WHERE ParentId IN :childIds AND UserOrGroupId IN :userIds AND RowCause = :ROW_CAUSE';
            List<SObject> toDelete = Database.query(q);
            if (!toDelete.isEmpty()) Database.delete(toDelete, /*allOrNone*/ false);
        }
    }
}