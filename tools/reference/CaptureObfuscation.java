import java.awt.Rectangle;
import java.awt.Robot;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.Locale;
import javax.imageio.ImageIO;

/** Optional native reference driver. Run only on an owned Linux Xvfb :96. */
public final class CaptureObfuscation {
    private static final int[] COLORS = {0xffaa00, 0x55ff55, 0x55ffff, 0xffff55, 0xffffff};
    private static final String[] NAMES = {"gold", "green", "aqua", "yellow", "white"};

    private static String hash(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    public static void main(String[] args) throws Exception {
        if (!System.getProperty("os.name").equals("Linux") ||
            !":96".equals(System.getenv("DISPLAY"))) {
            throw new IllegalStateException("Use a dedicated owned Xvfb :96, never the user's desktop");
        }
        if (args.length != 2 || !(args[1].equals("94") || args[1].equals("96"))) {
            throw new IllegalArgumentException("Output directory and MOTD crop y (94 or 96) required");
        }
        Path output = Path.of(args[0]);
        Files.createDirectory(output); // Preserve earlier measurements; never overwrite them.
        Robot robot = new Robot();
        robot.mouseMove(20, 200);
        Rectangle crop = new Rectangle(194, Integer.parseInt(args[1]), 440, 42);
        ArrayList<BufferedImage> frames = new ArrayList<>();
        long[] before = new long[240], after = new long[240];
        long start = System.nanoTime();
        for (int i = 0; i < before.length; i++) {
            long remaining = start + i * 8_333_333L - System.nanoTime();
            if (remaining > 0) Thread.sleep(remaining / 1_000_000, (int)(remaining % 1_000_000));
            before[i] = System.nanoTime() - start;
            frames.add(robot.createScreenCapture(crop));
            after[i] = System.nanoTime() - start;
        }
        // Encode and hash after sampling so image compression cannot pace the capture.
        StringBuilder json = new StringBuilder("[\n");
        for (int i = 0; i < frames.size(); i++) {
            BufferedImage image = frames.get(i);
            ByteArrayOutputStream png = new ByteArrayOutputStream();
            ImageIO.write(image, "png", png);
            byte[] bytes = png.toByteArray();
            String file = String.format(Locale.ROOT, "frame-%03d.png", i);
            Files.write(output.resolve(file), bytes);
            if (i > 0) json.append(",\n");
            json.append(String.format(Locale.ROOT,
                "{\"file\":\"%s\",\"beforeMs\":%.6f,\"afterMs\":%.6f,\"sha256\":\"%s\",\"masks\":{",
                file, before[i] / 1e6, after[i] / 1e6, hash(bytes)));
            for (int c = 0; c < COLORS.length; c++) {
                byte[] mask = new byte[crop.width * crop.height];
                for (int y = 0; y < crop.height; y++)
                    for (int x = 0; x < crop.width; x++)
                        if ((image.getRGB(x, y) & 0xffffff) == COLORS[c]) mask[y * crop.width + x] = 1;
                if (c > 0) json.append(',');
                json.append('"').append(NAMES[c]).append("\":\"").append(hash(mask)).append('"');
            }
            json.append("}}");
        }
        Files.writeString(output.resolve("frames.json"), json.append("\n]\n"));
        System.out.println("Recorded 240 cropped samples, monotonic times and foreground-mask hashes");
    }
}
