export type Attachment = {
  id: string;
  name: string;
  kind: "image" | "file";
};

export type Conversation = {
  id: string;
  title: string;
};

export type ConversationGroup = {
  id: string;
  label: string;
  items: Conversation[];
};
