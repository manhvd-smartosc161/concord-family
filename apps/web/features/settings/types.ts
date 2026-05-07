export interface SalaryRule {
  id: string;
  pctToPersonal: number;
  pctToJoint: number;
  fixedAmountToJoint: number | null;
}
