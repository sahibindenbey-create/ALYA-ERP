using System;
using System.Data;
using Microsoft.Data.SqlClient;

public class CariDAL
{
    // 1️⃣ SQL Server bağlantı cümlenizi buraya yazın
    private string connectionString = "Server=.;Database=ERPDB;Trusted_Connection=True;";

    // 2️⃣ Yeni cari ekleme
    public void CariEkle(string cariKodu, string cariAdi, int cariTipi, int companyId)
    {
        using SqlConnection conn = new SqlConnection(connectionString);
        conn.Open();

        string sql = @"
            INSERT INTO CariListesi (CompanyId, CariKodu, CariAdi, CariTipi, IsActive)
            VALUES (@CompanyId, @CariKodu, @CariAdi, @CariTipi, 1)";

        using SqlCommand cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CompanyId", companyId);
        cmd.Parameters.AddWithValue("@CariKodu", cariKodu);
        cmd.Parameters.AddWithValue("@CariAdi", cariAdi);
        cmd.Parameters.AddWithValue("@CariTipi", cariTipi);

        cmd.ExecuteNonQuery();
    }

    // 3️⃣ Cari listesini çekme
    public DataTable CariListele(int companyId)
    {
        using SqlConnection conn = new SqlConnection(connectionString);
        conn.Open();

        string sql = @"
            SELECT CariId, CariKodu, CariAdi, CariTipi 
            FROM CariListesi
            WHERE CompanyId=@CompanyId AND IsActive=1";

        using SqlCommand cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CompanyId", companyId);

        using SqlDataAdapter da = new SqlDataAdapter(cmd);
        DataTable dt = new DataTable();
        da.Fill(dt);

        return dt;
    }

    // 4️⃣ Cari bakiye hesaplama
    public decimal CariBakiyesi(int cariId)
    {
        using SqlConnection conn = new SqlConnection(connectionString);
        conn.Open();

        string sql = @"
            SELECT SUM(CASE WHEN HareketTipi=1 THEN Tutar ELSE -Tutar END)
            FROM CariHareketleri
            WHERE CariId=@CariId";

        using SqlCommand cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CariId", cariId);

        object result = cmd.ExecuteScalar();
        return result == DBNull.Value ? 0 : Convert.ToDecimal(result);
    }
}
