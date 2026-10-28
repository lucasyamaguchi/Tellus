using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace Tellus
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.WorkingDirectory = baseDir;
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c npm run desktop";
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Não foi possível iniciar o Tellus: " + ex.Message,
                    "Tellus - Erro de Inicialização",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
