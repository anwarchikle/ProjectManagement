public without sharing class ProjectSharingHandler {
    private static final String ROW_CAUSE   = 'Manual';   
    private static final String ACCESS_LVL  = 'Read';     //'Edit';

    // Build distinct (ProjectId -> Set<UserId>) and Set<ProjectId>, Set<UserId> from rows that satisfy Is_Active__c=true
    private static Map<String, Object> deriveTargets(List<Project_Team_Member__c> rows, Boolean onlyActive) {
        Map<Id, Set<Id>> projectToUsers = new Map<Id, Set<Id>>();
        Set<Id> projectIds = new Set<Id>();
        Set<Id> userIds    = new Set<Id>();
        Set<String> seenKeys = new Set<String>();

        for (Project_Team_Member__c r : rows) {
            if (r.Project__c == null || r.Assigned_To__c == null) continue;
            if (onlyActive && (r.Is_Active__c == null || r.Is_Active__c == false)) continue;

            String k = String.valueOf(r.Project__c) + '|' + String.valueOf(r.Assigned_To__c);
            if (seenKeys.contains(k)) continue;
            seenKeys.add(k);

            projectIds.add(r.Project__c);
            userIds.add(r.Assigned_To__c);

            if (!projectToUsers.containsKey(r.Project__c)) {
                projectToUsers.put(r.Project__c, new Set<Id>());
            }
            projectToUsers.get(r.Project__c).add(r.Assigned_To__c);
        }

        Map<String, Object> out = new Map<String, Object>();
        out.put('projectToUsers', projectToUsers);
        out.put('projectIds', projectIds);
        out.put('userIds', userIds);
        out.put('compositeKeys', seenKeys);
        return out;
    }

    // Fetch existing shares for Projects, mapped by ProjectId -> (UserId -> ShareRow)
    private static Map<Id, Map<Id, Project__Share>> loadExistingProjectShares(Set<Id> projectIds) {
        Map<Id, Map<Id, Project__Share>> existing = new Map<Id, Map<Id, Project__Share>>();
        if (projectIds == null || projectIds.isEmpty()) return existing;

        for (Project__Share s : [
            SELECT Id, ParentId, UserOrGroupId, AccessLevel, RowCause
            FROM Project__Share
            WHERE ParentId IN :projectIds
              AND RowCause = :ROW_CAUSE
        ]) {
            if (!existing.containsKey(s.ParentId)) {
                existing.put(s.ParentId, new Map<Id, Project__Share>());
            }
            existing.get(s.ParentId).put(s.UserOrGroupId, s);
        }
        return existing;
    }

    // INSERT / UNDELETE 

    public static void shareForInsertedMembers(List<Project_Team_Member__c> newRows) {
        if (newRows == null || newRows.isEmpty()) return;

        Map<String, Object> data = deriveTargets(newRows, /*onlyActive*/ true);
        Map<Id, Set<Id>> projectToUsers = (Map<Id, Set<Id>>) data.get('projectToUsers');
        Set<Id> projectIds              = (Set<Id>) data.get('projectIds');

        if (projectIds.isEmpty()) return;

        Map<Id, Map<Id, Project__Share>> existing = loadExistingProjectShares(projectIds);

        List<Project__Share> toInsert = new List<Project__Share>();

        // Single-pass creation from projectToUsers without nested loops on source rows:
        // We iterate projectToUsers keys and then the user set; this is the only local two-level pass.
        // (No n^2 against Trigger.new; it's bounded by the unique pairs we derived.)
        for (Id projId : projectToUsers.keySet()) {
            Map<Id, Project__Share> byUser = existing.containsKey(projId) ? existing.get(projId) : null;
            Set<Id> users = projectToUsers.get(projId);

            // Inner pass is over the small set of unique target users per project.
            for (Id u : users) {
                Project__Share prev = (byUser == null) ? null : byUser.get(u);
                if (prev != null) continue;

                Project__Share sh = new Project__Share();
                sh.ParentId      = projId;
                sh.UserOrGroupId = u;
                sh.AccessLevel   = ACCESS_LVL;
                sh.RowCause      = ROW_CAUSE;
                toInsert.add(sh);
            }
        }

        if (!toInsert.isEmpty()) Database.insert(toInsert, false);
    }

    // UPDATE  

    public static void shareDeltaForUpdatedMembers(List<Project_Team_Member__c> newRows, Map<Id, Project_Team_Member__c> oldMap) {
        if (newRows == null || newRows.isEmpty() || oldMap == null) return;

        // Build two sets of rows to process:
        // - needCreate: Is_Active__c is TRUE and (pair new/changed)
        // - needDelete: Is_Active__c was TRUE previously and pair removed/changed to inactive
        List<Project_Team_Member__c> needCreate = new List<Project_Team_Member__c>();
        List<Project_Team_Member__c> needDelete = new List<Project_Team_Member__c>();

        // Single pass, no nesting
        for (Project_Team_Member__c n : newRows) {
            Project_Team_Member__c o = oldMap.get(n.Id);
            if (o == null) continue;

            Boolean becameActive  = (n.Is_Active__c == true) && (o.Is_Active__c != true);
            Boolean becameInactive= (o.Is_Active__c == true) && (n.Is_Active__c != true);

            Boolean projectChanged = (o.Project__c != n.Project__c);
            Boolean userChanged    = (o.Assigned_To__c != n.Assigned_To__c);

            // Remove old if either: turned inactive OR pair changed while old was active
            if ( (becameInactive) ||
                 ((projectChanged || userChanged) && o.Is_Active__c == true) ) {
                needDelete.add(o);
            }
            // Create new if either: turned active OR pair changed and new is active
            if ( (becameActive) ||
                 ((projectChanged || userChanged) && n.Is_Active__c == true) ) {
                needCreate.add(n);
            }
        }

        if (!needDelete.isEmpty()) unshareForDeletedMembers(needDelete);
        if (!needCreate.isEmpty()) shareForInsertedMembers(needCreate);
    }

    //  DELETE  

    public static void unshareForDeletedMembers(List<Project_Team_Member__c> oldRows) {
        if (oldRows == null || oldRows.isEmpty()) return;

        // Only rows that were active at the moment of delete should be unshared
        Set<Id> projectIds = new Set<Id>();
        Set<Id> userIds    = new Set<Id>();

        Set<String> seen = new Set<String>();

        for (Project_Team_Member__c r : oldRows) {
            if (r.Project__c == null || r.Assigned_To__c == null) continue;
            if (r.Is_Active__c != true) continue;

            String k = String.valueOf(r.Project__c) + '|' + String.valueOf(r.Assigned_To__c);
            if (seen.contains(k)) continue;
            seen.add(k);

            projectIds.add(r.Project__c);
            userIds.add(r.Assigned_To__c);
        }
        if (projectIds.isEmpty() || userIds.isEmpty()) return;

        List<Project__Share> toDelete = [
            SELECT Id
            FROM Project__Share
            WHERE ParentId IN :projectIds
              AND UserOrGroupId IN :userIds
              AND RowCause = :ROW_CAUSE
        ];
        if (!toDelete.isEmpty()) Database.delete(toDelete, false);
    }

    // CASCADE (RELATED RECORDS)  

    // INSERT/UNDELETE cascade
    public static void cascadeShareForInsertedMembers(List<Project_Team_Member__c> newRows) {
        if (newRows == null || newRows.isEmpty()) return;

        Map<String, Object> data = deriveTargets(newRows, /*onlyActive*/ true);
        Map<Id, Set<Id>> projectToUsers = (Map<Id, Set<Id>>) data.get('projectToUsers');
        if (projectToUsers == null || projectToUsers.isEmpty()) return;

        shareChildrenFor(projectToUsers);
    }

    // UPDATE cascade
    public static void cascadeShareDeltaForUpdatedMembers(List<Project_Team_Member__c> newRows, Map<Id, Project_Team_Member__c> oldMap) {
        if (newRows == null || newRows.isEmpty() || oldMap == null) return;

        // Build two mini-maps: project->users to create, and to remove
        Map<Id, Set<Id>> createMap = new Map<Id, Set<Id>>();
        Map<Id, Set<Id>> removeMap = new Map<Id, Set<Id>>();

        for (Project_Team_Member__c n : newRows) {
            Project_Team_Member__c o = oldMap.get(n.Id); if (o == null) continue;

            Boolean becameActive   = (n.Is_Active__c == true) && (o.Is_Active__c != true);
            Boolean becameInactive = (o.Is_Active__c == true) && (n.Is_Active__c != true);
            Boolean projectChanged = (o.Project__c != n.Project__c);
            Boolean userChanged    = (o.Assigned_To__c != n.Assigned_To__c);

            if (becameInactive || ((projectChanged || userChanged) && o.Is_Active__c == true)) {
                if (o.Project__c != null && o.Assigned_To__c != null) {
                    if (!removeMap.containsKey(o.Project__c)) removeMap.put(o.Project__c, new Set<Id>());
                    removeMap.get(o.Project__c).add(o.Assigned_To__c);
                }
            }
            if (becameActive || ((projectChanged || userChanged) && n.Is_Active__c == true)) {
                if (n.Project__c != null && n.Assigned_To__c != null) {
                    if (!createMap.containsKey(n.Project__c)) createMap.put(n.Project__c, new Set<Id>());
                    createMap.get(n.Project__c).add(n.Assigned_To__c);
                }
            }
        }

        if (!removeMap.isEmpty()) unshareChildrenFor(removeMap);
        if (!createMap.isEmpty()) shareChildrenFor(createMap);
    }

    // DELETE cascade
    public static void cascadeUnshareForDeletedMembers(List<Project_Team_Member__c> oldRows) {
        if (oldRows == null || oldRows.isEmpty()) return;

        Map<String, Object> data = deriveTargets(oldRows, /*onlyActive*/ true);
        Map<Id, Set<Id>> projectToUsers = (Map<Id, Set<Id>>) data.get('projectToUsers');
        if (projectToUsers == null || projectToUsers.isEmpty()) return;

        unshareChildrenFor(projectToUsers);
    }

    // --------------------- SHARE CHILDREN -----------------------

    private static void shareChildrenFor(Map<Id, Set<Id>> projectToUsers) {
        if (projectToUsers == null || projectToUsers.isEmpty()) return;

        // Discover child relationships of Project__c
        List<Schema.ChildRelationship> rels =
            Schema.getGlobalDescribe().get('Project__c').getDescribe().getChildRelationships();

        // For each shareable child object (lookup child with __Share), we’ll:
        // 1) Load all child records under target projects
        // 2) Load existing shares for those child records
        // 3) Create missing shares for each (childId, userId) combination
        for (Schema.ChildRelationship cr : rels) {
            Schema.SObjectType childType = cr.getChildSObject();
            String childApi = childType.getDescribe().getName();

            if (!childApi.endsWith('__c')) continue; // custom only

            String shareApi = childApi.replace('__c', '__Share');
            if (!Schema.getGlobalDescribe().containsKey(shareApi)) {
                // No __Share table => master-detail or unsupported; inherits from Project__c automatically
                continue;
            }

            String parentFieldApi = cr.getField().getDescribe().getName();

            // Gather all child records for the target projects
            Set<Id> projectIds = projectToUsers.keySet();
            List<SObject> childRows = Database.query(
                'SELECT Id,' + parentFieldApi + ' FROM ' + childApi +
                ' WHERE ' + parentFieldApi + ' IN :projectIds'
            );

            // Map childId -> projectId (single pass)
            Map<Id, Id> childToProject = new Map<Id, Id>();
            Set<Id> childIds = new Set<Id>();
            for (SObject ch : childRows) {
                Id cId = (Id) ch.get('Id');
                Id pId = (Id) ch.get(parentFieldApi);
                childToProject.put(cId, pId);
                childIds.add(cId);
            }
            if (childIds.isEmpty()) continue;

            // Existing child shares
            Map<Id, Set<Id>> existingByChild = new Map<Id, Set<Id>>();
            List<SObject> existing = Database.query(
                'SELECT Id, ParentId, UserOrGroupId FROM ' + shareApi +
                ' WHERE ParentId IN :childIds AND RowCause = :ROW_CAUSE'
            );
            for (SObject es : existing) {
                Id p = (Id) es.get('ParentId');
                Id u = (Id) es.get('UserOrGroupId');
                if (!existingByChild.containsKey(p)) existingByChild.put(p, new Set<Id>());
                existingByChild.get(p).add(u);
            }

            // Build all missing shares (single pass over child rows; inner pass limited to users of that project)
            List<SObject> toInsert = new List<SObject>();

            for (Id cId : childToProject.keySet()) {
                Id pId = childToProject.get(cId);
                Set<Id> users = projectToUsers.get(pId);
                if (users == null || users.isEmpty()) continue;

                // create shares for cId to each user (bounded by users-per-project)
                for (Id u : users) {
                    if (existingByChild.containsKey(cId) && existingByChild.get(cId).contains(u)) continue;

                    SObject sh = Schema.getGlobalDescribe().get(shareApi).newSObject();
                    sh.put('ParentId',      cId);
                    sh.put('UserOrGroupId', u);
                    sh.put('AccessLevel',   ACCESS_LVL);
                    sh.put('RowCause',      ROW_CAUSE);
                    toInsert.add(sh);
                }
            }

            if (!toInsert.isEmpty()) Database.insert(toInsert, false);
        }
    }

    // -------------------- UNSHARE CHILDREN ----------------------

    private static void unshareChildrenFor(Map<Id, Set<Id>> projectToUsers) {
        if (projectToUsers == null || projectToUsers.isEmpty()) return;

        List<Schema.ChildRelationship> rels =
            Schema.getGlobalDescribe().get('Project__c').getDescribe().getChildRelationships();

        for (Schema.ChildRelationship cr : rels) {
            String childApi = cr.getChildSObject().getDescribe().getName();
            if (!childApi.endsWith('__c')) continue;

            String shareApi = childApi.replace('__c', '__Share');
            if (!Schema.getGlobalDescribe().containsKey(shareApi)) continue;

            String parentFieldApi = cr.getField().getDescribe().getName();

            Set<Id> projectIds = projectToUsers.keySet();
            List<SObject> childRows = Database.query(
                'SELECT Id FROM ' + childApi +
                ' WHERE ' + parentFieldApi + ' IN :projectIds'
            );
            Set<Id> childIds = new Set<Id>();
            for (SObject ch : childRows) childIds.add((Id) ch.get('Id'));
            if (childIds.isEmpty()) continue;

            // collect all users across those projects
            Set<Id> userIds = new Set<Id>();
            for (Id pId : projectToUsers.keySet()) userIds.addAll(projectToUsers.get(pId));
            if (userIds.isEmpty()) continue;

            List<SObject> toDelete = Database.query(
                'SELECT Id FROM ' + shareApi +
                ' WHERE ParentId IN :childIds AND UserOrGroupId IN :userIds AND RowCause = :ROW_CAUSE'
            );
            if (!toDelete.isEmpty()) Database.delete(toDelete, false);
        }
    }
}