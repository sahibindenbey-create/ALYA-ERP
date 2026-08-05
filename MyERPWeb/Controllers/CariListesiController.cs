using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyERPWeb.Data;   // DbContext için
using MyERPWeb.Models; // Model için

namespace MyERPWeb.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CariListesiController : ControllerBase
    {
        private readonly MyERPDbContext _context;

        public CariListesiController(MyERPDbContext context)
        {
            _context = context;
        }

        // GET: api/CariListesi
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var list = await _context.CariListesi.ToListAsync();
            return Ok(list);
        }

        // POST: api/CariListesi
        [HttpPost]
        public async Task<IActionResult> Post(CariListesi cari)
        {
            _context.CariListesi.Add(cari);
            await _context.SaveChangesAsync();
            return Ok(cari);
        }

        // İstersen buraya PUT ve DELETE metodları da ekleyebilirsin
    }
}
