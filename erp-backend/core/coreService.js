async function assertPeriodOpen({ poolPromise, sql, companyId, operationDate, moduleCode = null }) {
  const date = operationDate instanceof Date ? operationDate : new Date(operationDate);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error('Geçersiz işlem tarihi.'), { statusCode: 400 });
  const pool = await poolPromise;
  const result = await pool.request()
    .input('CompanyId', sql.Int, Number(companyId))
    .input('OperationDate', sql.Date, date)
    .input('ModuleCode', sql.NVarChar(64), moduleCode)
    .query(`
      SELECT TOP (1) PeriodId, PeriodCode, Status FROM dbo.FiscalPeriods
      WHERE CompanyId=@CompanyId AND @OperationDate BETWEEN StartDate AND EndDate ORDER BY StartDate DESC;
      SELECT TOP (1) PeriodLockId, Reason, ModuleCode FROM dbo.PeriodLocks
      WHERE CompanyId=@CompanyId AND IsActive=1
        AND @OperationDate BETWEEN LockStartDate AND LockEndDate
        AND (ModuleCode IS NULL OR ModuleCode=@ModuleCode)
      ORDER BY CASE WHEN ModuleCode IS NULL THEN 1 ELSE 0 END, PeriodLockId DESC;
    `);
  const period = result.recordsets[0]?.[0];
  const lock = result.recordsets[1]?.[0];
  if (!period) throw Object.assign(new Error('İşlem tarihi tanımlı bir mali döneme ait değil.'), { statusCode: 409 });
  if (period.Status !== 'Open') throw Object.assign(new Error(`Mali dönem işlem kabul etmiyor: ${period.PeriodCode} (${period.Status})`), { statusCode: 409 });
  if (lock) throw Object.assign(new Error(lock.Reason || 'Seçilen tarih aralığı kilitli.'), { statusCode: 409 });
  return period;
}

async function nextDocumentNumber({ poolPromise, sql, companyId, documentType, transaction = null }) {
  const owner = transaction || await poolPromise;
  const request = transaction ? new sql.Request(transaction) : owner.request();
  const result = await request
    .input('CompanyId', sql.Int, Number(companyId))
    .input('DocumentType', sql.NVarChar(64), String(documentType || '').trim().toUpperCase())
    .query(`
      DECLARE @NowYear INT=YEAR(GETDATE());
      UPDATE dbo.NumberSeries WITH (UPDLOCK, HOLDLOCK)
      SET LastNumber=CASE WHEN ResetYearly=1 AND CurrentYear<>@NowYear THEN 1 ELSE LastNumber+1 END,
          CurrentYear=CASE WHEN ResetYearly=1 THEN @NowYear ELSE CurrentYear END,
          UpdatedAt=SYSUTCDATETIME()
      OUTPUT INSERTED.Prefix, INSERTED.Suffix, INSERTED.Padding, INSERTED.CurrentYear, INSERTED.LastNumber
      WHERE CompanyId=@CompanyId AND DocumentType=@DocumentType AND IsActive=1;
    `);
  const row = result.recordset[0];
  if (!row) throw Object.assign(new Error('Aktif belge numara serisi bulunamadı.'), { statusCode: 404 });
  const serial = String(row.LastNumber).padStart(row.Padding, '0');
  const year = row.CurrentYear ? String(row.CurrentYear) : '';
  return `${row.Prefix || ''}${year}${year && row.Prefix && !row.Prefix.endsWith('-') ? '-' : ''}${serial}${row.Suffix || ''}`;
}

async function writeAudit({ poolPromise, sql, companyId, userId = null, actionCode, entityType, entityId = null, before = null, after = null, req = null, transaction = null }) {
  const owner = transaction || await poolPromise;
  const request = transaction ? new sql.Request(transaction) : owner.request();
  await request
    .input('CompanyId', sql.Int, Number(companyId))
    .input('KullaniciId', sql.Int, userId ? Number(userId) : null)
    .input('ActionCode', sql.NVarChar(64), actionCode)
    .input('EntityType', sql.NVarChar(120), entityType)
    .input('EntityId', sql.NVarChar(120), entityId == null ? null : String(entityId))
    .input('BeforeJson', sql.NVarChar(sql.MAX), before == null ? null : JSON.stringify(before))
    .input('AfterJson', sql.NVarChar(sql.MAX), after == null ? null : JSON.stringify(after))
    .input('IpAddress', sql.NVarChar(64), req?.ip || req?.socket?.remoteAddress || null)
    .input('UserAgent', sql.NVarChar(500), req?.headers?.['user-agent'] || null)
    .query(`INSERT dbo.AuditLogs(CompanyId,KullaniciId,ActionCode,EntityType,EntityId,BeforeJson,AfterJson,IpAddress,UserAgent)
            VALUES(@CompanyId,@KullaniciId,@ActionCode,@EntityType,@EntityId,@BeforeJson,@AfterJson,@IpAddress,@UserAgent);`);
}

module.exports = { assertPeriodOpen, nextDocumentNumber, writeAudit };
