import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface CancelPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  description: string;
  onConfirm: () => void;
}

const CancelPlanDialog = ({
  open,
  onOpenChange,
  planName,
  description,
  onConfirm,
}: CancelPlanDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Cancel {planName}?</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep plan</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onConfirm}>
          Cancel plan
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default CancelPlanDialog;
