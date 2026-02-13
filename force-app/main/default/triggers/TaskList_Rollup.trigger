trigger TaskList_Rollup on Task_List__c (after insert, after update, after delete, after undelete) {
    if (TimeHierarchyRollupService.isRunning()) return;

    Set<Id> milestoneIds = new Set<Id>();

    if (Trigger.isInsert || Trigger.isUndelete || Trigger.isUpdate) {
        for (Task_List__c n : Trigger.new) {
            if (n.Milestone__c != null) milestoneIds.add(n.Milestone__c);
        }
    }
    if (Trigger.isUpdate) {
        for (Integer i = 0; i < Trigger.new.size(); i++) {
            Task_List__c n = Trigger.new[i];
            Task_List__c o = Trigger.old[i];
            if (o.Milestone__c != n.Milestone__c && o.Milestone__c != null) {
                milestoneIds.add(o.Milestone__c); // old parent also impacted
            }
        }
    }
    if (Trigger.isDelete) {
        for (Task_List__c o : Trigger.old) {
            if (o.Milestone__c != null) milestoneIds.add(o.Milestone__c);
        }
    }

    if (!milestoneIds.isEmpty()) {
        System.enqueueJob(new TimeHierarchyRollupJob(null, milestoneIds, null));
    }
}