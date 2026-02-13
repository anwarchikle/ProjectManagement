trigger TaskOwnerTrigger on Task_Owner__c (after insert, after update, after delete, after undelete) {
   /* if (Trigger.isAfter) {
        if (Trigger.isInsert) {
            TaskOwnerSharingHandler.createSharing(Trigger.new);
            TaskOwnerSharingHandler.cascadeChildSharing(Trigger.new);
        }

        if (Trigger.isUpdate) {
            TaskOwnerSharingHandler.updateSharing(Trigger.new, Trigger.oldMap);
            TaskOwnerSharingHandler.cascadeChildSharingOnUpdate(Trigger.new, Trigger.oldMap);
        }

        if (Trigger.isDelete) {
            TaskOwnerSharingHandler.removeSharing(Trigger.old);
            TaskOwnerSharingHandler.removeChildSharing(Trigger.old);
        }

        if (Trigger.isUndelete) {
            TaskOwnerSharingHandler.createSharing(Trigger.new);
            TaskOwnerSharingHandler.cascadeChildSharing(Trigger.new);
        }
    } */
}