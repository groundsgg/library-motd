import java.awt.Robot;
import java.awt.Rectangle;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.io.File;
import javax.imageio.ImageIO;

/** Optional Linux/Xvfb maintainer capture driver; no game classes or assets. */
public final class CapturePanorama {
    public static void main(String[] args) throws Exception {
        String display = System.getenv("DISPLAY");
        if (!System.getProperty("os.name").equals("Linux") || display == null ||
            !display.matches(":[1-9][0-9]+(?:\\.[0-9]+)?")) {
            throw new IllegalStateException("Use a dedicated Linux Xvfb display, never the user's desktop");
        }
        Robot robot = new Robot();
        robot.setAutoDelay(100);
        if (args.length == 3) {
            robot.mouseMove(Integer.parseInt(args[1]), Integer.parseInt(args[2]));
            robot.mousePress(InputEvent.BUTTON1_DOWN_MASK);
            robot.mouseRelease(InputEvent.BUTTON1_DOWN_MASK);
            robot.delay(350);
        } else if (args.length == 2 && args[1].equals("escape")) {
            robot.keyPress(KeyEvent.VK_ESCAPE);
            robot.keyRelease(KeyEvent.VK_ESCAPE);
            robot.delay(350);
        }
        ImageIO.write(robot.createScreenCapture(new Rectangle(0, 0, 854, 480)), "png", new File(args[0]));
    }
}
