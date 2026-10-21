import com.google.gson.*;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.serializer.gson.GsonComponentSerializer;
public class Generate {
  public static void main(String[] args) {
    String[] inputs = {"<red>A<b>B</b>C", "<gradient:#ff0000:#0000ff>ABCD</gradient>", "<gradient:#ff0000:#00ff00:#0000ff>ABCDEFGH</gradient>", "<b>A<!bold>B</!bold>C", "\\<red>text", "<rainbow>ABCD</rainbow>", "<gradient:#ff0000:#0000ff:0.5>ABCD</gradient>", "<rainbow:!>ABCD</rainbow>", "<gradient:#ff0000:#0000ff>A<green>B</green>C</gradient>"};
    JsonArray output=new JsonArray();
    for(String input:inputs){JsonObject o=new JsonObject();o.addProperty("input",input);o.add("component",JsonParser.parseString(GsonComponentSerializer.gson().serialize(MiniMessage.miniMessage().deserialize(input))));output.add(o);}
    System.out.println(output);
  }
}
