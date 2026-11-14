// Three sample files for the import pipeline. The tests and the web page use them.
// ALL of this data is synthetic: a fictional person who is paid on the 25th of each month,
// two fictional banks (Northbank and Harbour Bank), fictional merchants, amounts in rand.
// The samples show the difficult cases on purpose: a fee row, two equal purchases on one day,
// a transfer between the two accounts, a pending row, a purchase with its reversal, an unknown layout.
import type { MappingProfile } from './profiles.ts';

/** The account names that the samples are imported into. */
export const NORTHBANK_ACCOUNT = 'northbank-current';
export const HARBOUR_ACCOUNT = 'harbour-everyday';

/** Northbank: semicolons, DD/MM/YYYY, decimal comma, a Debit and a Credit column, a running balance. 14 rows. */
export const NORTHBANK_SAMPLE = [
  'Posting Date;Details;Debit;Credit;Balance',
  '25/02/2026;SALARY ACME LOGISTICS;;28 500,00;32 700,00',
  '26/02/2026;DEBIT ORDER CITYVIEW RENTALS;9 500,00;;23 200,00',
  '27/02/2026;TRANSFER TO SAVINGS POCKET;3 000,00;;20 200,00',
  '01/03/2026;CARD PURCHASE GREENLEAF MARKET CARD 4821;842,35;;19 357,65',
  '02/03/2026;CARD PURCHASE METRO FUEL STOP CARD 4821;950,00;;18 407,65',
  '03/03/2026;TRANSFER TO HARBOUR BANK 620011873;2 500,00;;15 907,65',
  '03/03/2026;FEE: IMMEDIATE PAYMENT;10,00;;15 897,65',
  '05/03/2026;CARD PURCHASE CORNER CAFE CARD 4821;68,00;;15 829,65',
  '05/03/2026;CARD PURCHASE CORNER CAFE CARD 4821;68,00;;15 761,65',
  '07/03/2026;DEBIT ORDER BRIGHTLINE FIBRE;699,00;;15 062,65',
  '09/03/2026;CARD PURCHASE GREENLEAF MARKET CARD 4821;1 204,90;;13 857,75',
  '10/03/2026;PREPAID ELECTRICITY RIVERTON POWER;600,00;;13 257,75',
  '12/03/2026;CARD PURCHASE PAGE AND QUILL BOOKS CARD 4821;329,95;;12 927,80',
  '14/03/2026;FEE: MONTHLY ACCOUNT FEE;115,00;;12 812,80',
  '',
].join('\n');

/** Harbour Bank: each cell quoted, commas, ISO dates, one signed amount (negative is money out), a Type column. 10 rows. */
export const HARBOUR_SAMPLE = [
  '"Date","Time","Type","Description","Amount"',
  '"2026-03-01","08:15","INTEREST","Interest earned","12.40"',
  '"2026-03-02","12:41","PURCHASE","Sunrise Pharmacy, Main Road","-245.50"',
  '"2026-03-04","06:02","TRANSFER","Transfer from Northbank","2500.00"',
  '"2026-03-05","18:30","PURCHASE","Tidewater Grill","-420.00"',
  '"2026-03-06","09:10","PURCHASE","Lumen Electronics","-1899.00"',
  '"2026-03-08","14:22","REVERSAL","Lumen Electronics","1899.00"',
  '"2026-03-09","10:05","EFT","Hillside Dental Practice","-650.00"',
  '"2026-03-10","07:00","FEE","Monthly service fee","-69.00"',
  '"2026-03-11","16:45","PURCHASE","Kite ""Express"" Couriers","-85.00"',
  '"2026-03-12","19:03","PENDING","Orbit Streaming","-159.00"',
  '',
].join('\n');

/** A third layout that matches no profile: tabs, MM/DD/YYYY, a "Money out" and a "Money in" column. 5 rows. */
export const UNKNOWN_SAMPLE = [
  ['When', 'What', 'Money out', 'Money in'],
  ['03/02/2026', 'Garden centre', '310.00', ''],
  ['03/05/2026', 'Refund from Garden centre', '', '45.00'],
  ['03/13/2026', 'Bus card top-up', '200.00', ''],
  ['03/15/2026', 'Side work payment', '', '1 500.00'],
  ['03/20/2026', 'Water and lights', '1 120.75', ''],
]
  .map((cells) => cells.join('\t'))
  .join('\n') + '\n';

/** The mapping that a person makes by hand for UNKNOWN_SAMPLE. It must pass validateMapping, like each mapping. */
export const UNKNOWN_PROFILE: MappingProfile = {
  id: 'hand-made',
  name: 'A mapping made by hand for the tab-separated sample',
  columns: { date: 'When', description: 'What', debit: 'Money out', credit: 'Money in' },
  date_format: 'MM/DD/YYYY',
  decimal: '.',
};
