package com.astro.content.explore;

import org.commonmark.node.Code;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.Heading;
import org.commonmark.node.HtmlBlock;
import org.commonmark.node.HtmlInline;
import org.commonmark.node.Image;
import org.commonmark.node.Node;
import org.commonmark.node.SoftLineBreak;
import org.commonmark.node.Text;
import org.commonmark.parser.Parser;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

@Component
public class ExploreMarkdownAnalyzer {
    public record MarkdownImage(String url, String alt, String title) { }
    public record Analysis(List<MarkdownImage> images) { }

    private final Parser parser = Parser.builder().build();

    public Analysis analyze(String markdown) {
        Node document = parser.parse(markdown == null ? "" : markdown);
        List<MarkdownImage> images = new ArrayList<>();
        walk(document, images);
        if (images.size() > 30) throw new ExploreValidationException("Explore articles may contain at most 30 images");
        return new Analysis(List.copyOf(images));
    }

    public void requireHttps(String value, String field) {
        if (value == null || value.isBlank()) return;
        try {
            URI uri = URI.create(value.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw new ExploreValidationException(field + " must be an absolute HTTPS URL");
            }
        } catch (IllegalArgumentException error) {
            throw new ExploreValidationException(field + " must be a valid absolute HTTPS URL");
        }
    }

    private void walk(Node node, List<MarkdownImage> images) {
        if (node instanceof HtmlBlock || node instanceof HtmlInline) {
            throw new ExploreValidationException("Raw HTML is not allowed in explore Markdown");
        }
        if (node instanceof Heading heading && heading.getLevel() == 1) {
            throw new ExploreValidationException("Use the article title instead of an H1 in the Markdown body");
        }
        if (node instanceof Image image) {
            requireHttps(image.getDestination(), "Markdown image URL");
            images.add(new MarkdownImage(image.getDestination(), plainText(image).trim(), image.getTitle()));
        }
        for (Node child = node.getFirstChild(); child != null; child = child.getNext()) walk(child, images);
    }

    private String plainText(Node node) {
        StringBuilder value = new StringBuilder();
        appendText(node, value);
        return value.toString();
    }

    private void appendText(Node node, StringBuilder value) {
        if (node instanceof Text text) value.append(text.getLiteral());
        else if (node instanceof Code code) value.append(code.getLiteral());
        else if (node instanceof SoftLineBreak || node instanceof HardLineBreak) value.append(' ');
        for (Node child = node.getFirstChild(); child != null; child = child.getNext()) appendText(child, value);
    }
}
