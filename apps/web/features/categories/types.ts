export interface CategoryView {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  icon: string | null;
  isEssential: boolean;
}
