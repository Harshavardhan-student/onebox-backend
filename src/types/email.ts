export type Category = 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office' | 'Unknown'

export interface EmailDoc {
  id: string
  subject?: string
  body?: string
  from?: string
  to?: string
  date?: string
  category?: Category
  notifiedInterested?: boolean
  
  [key: string]: any
}
