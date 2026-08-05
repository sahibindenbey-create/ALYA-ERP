using Microsoft.EntityFrameworkCore;
using MyERPWeb.Models; // Model klasöründeki CariListesi için

namespace MyERPWeb.Data   // <- Burayı Data klasörü için yapıyoruz
{
    public class MyERPDbContext : DbContext
    {
        public MyERPDbContext(DbContextOptions<MyERPDbContext> options)
            : base(options)
        {
        }

        public DbSet<CariListesi> CariListesi { get; set; }
    }
}
