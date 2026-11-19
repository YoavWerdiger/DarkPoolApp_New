-- Funds without a manager name show up as a firm, not a person.
-- Fill in the known managers (only where manager_name is empty).
update public.dark_pool_fund_managers m
   set manager_name = v.manager
  from (values
    ('1647251', 'Chris Hohn'),
    ('1747057', 'Dan Sundheim'),
    ('1791786', 'Paul Singer'),
    ('1061165', 'David Craver'),
    ('1569205', 'Terry Smith'),
    ('1387322', 'Alex Sacerdote'),
    ('1541617', 'Brad Gerstner'),
    ('1798849', 'Henry Ellenbogen'),
    ('1418814', 'Mason Morfit'),
    ('1602189', 'Marc Stad'),
    ('1358706', 'David Abrams'),
    ('1112520', 'Chuck Akre'),
    ('1709323', 'Li Lu'),
    ('2045724', 'Leopold Aschenbrenner')
  ) as v(cik, manager)
 where m.cik = v.cik
   and coalesce(trim(m.manager_name), '') = '';
