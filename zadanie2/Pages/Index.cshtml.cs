using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Collections.Generic;
using System.Text.Json;
using System;

namespace zadanie2.Pages
{
    public class IndexModel : PageModel
    {
        private readonly ILogger<IndexModel> _logger;
        private Dictionary<string, List<string>> ModelsData { get; set; } = new Dictionary<string, List<string>>();

        /// <summary>
        /// Get all dirs' names from path
        /// </summary>
        private List<string> GetDirsNames(string path)
        {
            var dirs = Directory.GetDirectories(path);
            var names = new List<string>();

            foreach (var dir in dirs)
            {

                var split = dir.Split('/');
                names.Add(split[split.Length - 1]);
            }

            return names;
        }

        public IndexModel(ILogger<IndexModel> logger)
        {
            // get all formats' names
            var dirsNames = GetDirsNames(@"wwwroot/models/");

            // for every format, load models
            foreach (var dirName in dirsNames)
            {
                var subDirs = GetDirsNames($"wwwroot/models/{dirName}/");
                ModelsData[dirName] = subDirs;
            }

            _logger = logger;
        }

        public void OnGet()
        {

        }

        public JsonResult OnGetModelsData()
        {
            return new JsonResult(ModelsData);
        }
    }
}
