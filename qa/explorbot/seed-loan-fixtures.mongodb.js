// Run only after seed:books, using the dedicated local QA replica set.
// mongosh 'mongodb://127.0.0.1:27029/ctulib_explorbot_e2e?replicaSet=ctulibQArs' --file qa/explorbot/seed-loan-fixtures.mongodb.js
const serverOptions = db.adminCommand({ getCmdLineOpts: 1 }).parsed;
if (db.getName() !== 'ctulib_explorbot_e2e' || serverOptions.net?.port !== 27029 || serverOptions.net?.bindIp !== '127.0.0.1') {
  throw new Error('Refusing to seed outside the isolated local ctulib_explorbot_e2e database');
}

const facultyId = ObjectId('ee584419975de7543b8c2fd2');
const readerAccount = db.acounts.findOne({ ctuIdentifier: 'B9900001', role: 'READER' });
const employeeAccount = db.acounts.findOne({ ctuIdentifier: 'CB99101', role: 'EMPLOYEE' });
if (!readerAccount || !employeeAccount || db.books.countDocuments() !== 12) {
  throw new Error('Run the existing seed:books fixture first');
}

const permissionNames = ['MANAGE_LOANS', 'APPROVE_HANDOVER', 'PROCESS_RETURN'];
for (const permissionName of permissionNames) {
  db.permissions.updateOne(
    { permissionName },
    { $set: { description: `Quyền kiểm thử nghiệp vụ ${permissionName}` } },
    { upsert: true },
  );
}
const permissionIds = db.permissions
  .find({ permissionName: { $in: permissionNames } }, { _id: 1 })
  .toArray()
  .map((permission) => permission._id);

db.readers.updateOne(
  { _id: readerAccount._id },
  {
    $set: {
      fullName: 'Độc giả QA', readerType: 'STUDENT', facultyId,
      isBorrowingBlocked: false, isBorrowingManuallyBlocked: false,
      borrowingBlockReason: '',
    },
    $setOnInsert: { loanReservationVersion: 0 },
  },
  { upsert: true },
);

db.employees.updateOne(
  { _id: employeeAccount._id },
  { $set: { fullName: 'Thủ thư QA', position: 'Thủ thư', permissionIds } },
  { upsert: true },
);

printjson({
  fixture: 'CTULib E2E',
  reader: readerAccount.ctuIdentifier,
  employee: employeeAccount.ctuIdentifier,
  permissions: permissionNames,
  books: db.books.countDocuments(),
});
