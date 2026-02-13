trigger Tasks_Rollup on Tasks__c (after insert, after update, after delete, after undelete) {
   /* if (TimeHierarchyRollupService.isRunning()) return;

    Set<Id> taskListIds = new Set<Id>();

    if (Trigger.isInsert || Trigger.isUndelete || Trigger.isUpdate) {
        for (Tasks__c n : Trigger.new) {
            if (n.Task_List__c != null) taskListIds.add(n.Task_List__c);
        }
    }
    if (Trigger.isUpdate) {
        for (Integer i = 0; i < Trigger.new.size(); i++) {
            Tasks__c n = Trigger.new[i];
            Tasks__c o = Trigger.old[i];
            if (o.Task_List__c != n.Task_List__c && o.Task_List__c != null) {
                taskListIds.add(o.Task_List__c); // old parent also impacted
            }
        }
    }
    if (Trigger.isDelete) {
        for (Tasks__c o : Trigger.old) {
            if (o.Task_List__c != null) taskListIds.add(o.Task_List__c);
        }
    }

    if (!taskListIds.isEmpty()) {
        System.enqueueJob(new TimeHierarchyRollupJob(taskListIds, null, null));
    } */
}