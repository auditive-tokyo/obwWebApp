export type Message = {
  id: number;
  text: string | { assistant_response_text: string; reference_files?: string[] };
  personal: boolean;
  loading?: boolean;
  timestamp?: string;
};